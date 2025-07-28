// src/mediasoup/Room.ts
import Peer from "./Peer";
import * as io from "socket.io";
import { Router } from "mediasoup/node/lib/RouterTypes";
import { DtlsParameters, RtpParameters, Worker, MediaKind, RtpCapabilities, WebRtcTransport } from "mediasoup/node/lib/types";
import { config } from "../utils/config";
import { WebSocketEventType } from "./enums";

export default class Room
{
  id: string;
  _peers: Map<string, Peer>;
  io: io.Server;
  private _router: Router | null = null;
  private _pausedVideoProducerIds: Set<string> = new Set();
  private _pausedAudioProducerIds: Set<string> = new Set();

  constructor(id: string, io: io.Server, worker: Worker)
  {
    this.id = id;
    this._peers = new Map<string, Peer>();
    this.io = io;
  }

  // Initialize the router asynchronously
  public async initialize(worker: Worker): Promise<void>
  {
    if (this._router)
    {
      console.log(`Router already initialized for room ${this.id}`);
      return;
    }

    try
    {
      const mediaCodecs = config.mediaSoup.router.mediaCodecs;
      this._router = await worker.createRouter({ mediaCodecs });
      console.log(`Router created for room ${this.id}, router ID: ${this._router.id}`);

      // Set up router event listeners
      this._router.on("workerclose", () =>
      {
        console.log(`Router ${this._router?.id} closed due to worker closure`);
        this._router = null; // Reset router on closure
      });
    } catch (error)
    {
      console.error(`Error creating router for room ${this.id}:`, error);
      throw error; // Let the caller handle the failure
    }
  }

  // Ensure router is initialized before proceeding
  private ensureRouterInitialized(): void
  {
    if (!this._router || this._router.closed)
    {
      throw new Error(`Router is not initialized or has been closed for room ${this.id}`);
    }
  }

  public createPeer(name: string, userId: string)
  {
    if (this._peers.has(userId))
    {
      return;
    }
    this._peers.set(userId, new Peer(userId, name));
    return this._peers.get(userId);
  }

  public removePeer(userId: string)
  {
    const peer = this._peers.get(userId);
    if (!peer)
    {
      return;
    }
    // Clean up paused producers associated with this peer
    const producers = peer.get_producers();
    producers.forEach((producer) =>
    {
      if (producer.kind === "video")
      {
        this._pausedVideoProducerIds.delete(producer.id);
      } else if (producer.kind === "audio")
      {
        this._pausedAudioProducerIds.delete(producer.id);
      }
    });
    this._peers.delete(userId);
    // Broadcast updated paused producer lists
    this.io.to(this.id).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, Array.from(this._pausedVideoProducerIds));
    this.io.to(this.id).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, Array.from(this._pausedAudioProducerIds));
    return peer;
  }

  public getCurrentPeers(userId: string)
  {
    const peers: { id: string; name: string }[] = [];
    Array.from(this._peers.keys())
      .filter((key) => key !== userId)
      .forEach((peerId) =>
      {
        if (this._peers.has(peerId))
        {
          const { id, name } = this._peers.get(peerId)!;
          peers.push({ id, name });
        }
      });

    return peers;
  }

  public async createWebRtcTransport(userId: string)
  {
    // Ensure router is initialized
    this.ensureRouterInitialized();

    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediaSoup.webRTCTransport;

    try
    {
      const transport = await this._router!.createWebRtcTransport({
        listenIps: config.mediaSoup.webRTCTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
      });

      if (maxIncomingBitrate)
      {
        try
        {
          await transport.setMaxIncomingBitrate(maxIncomingBitrate);
          console.log(`Max incoming bitrate set to ${maxIncomingBitrate} for transport ${transport.id}`);
        } catch (error)
        {
          console.error("Error setting max incoming bitrate:", error);
        }
      }

      transport.on("dtlsstatechange", (dtlsState) =>
      {
        if (dtlsState === "closed")
        {
          console.log("Transport closed", {
            name: this._peers.get(userId)?.name,
            transportId: transport.id,
          });
          transport.close();
        }
      });

      transport.on("@close", () =>
      {
        console.log("Transport closed", {
          name: this._peers.get(userId)?.name,
          transportId: transport.id,
        });
      });

      transport.on("routerclose", () =>
      {
        console.log("Transport closed due to router closure", {
          transportId: transport.id,
        });
        transport.close();
      });

      console.log("Adding transport", { transportId: transport.id });
      const peer = this._peers.get(userId);
      if (!peer)
      {
        console.error("Peer not found for userId:", userId);
        throw new Error(`Peer not found for userId: ${userId}`);
      }
      peer.addTransport(transport);

      return {
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      };
    } catch (error)
    {
      console.error(`Error creating WebRTC transport for user ${userId} in room ${this.id}:`, error);
      throw error; // Let the caller handle the failure
    }
  }

  public async connectPeerTransport(userId: string, transportId: string, dtlsParameters: DtlsParameters)
  {
    const peer = this._peers.get(userId);
    if (!peer)
    {
      console.log("No peer found with this id");
      throw new Error(`Peer not found for userId: ${userId}`);
    }

    await peer.connectTransport(transportId, dtlsParameters);
  }

  public getRtpCapabilities()
  {
    this.ensureRouterInitialized();
    return this._router!.rtpCapabilities;
  }

  // To get the active producers in the room 
  getProducerListForPeer()
  {
    let producerList: { userId: string; producer_id: string; kind: MediaKind }[] = [];
    this._peers.forEach((peer) =>
    {
      peer.get_producers().forEach((producer) =>
      {
        producerList.push({
          userId: peer.id,
          producer_id: producer.id,
          kind: producer.kind,
        });
      });
    });
    return producerList;
  }

  public async produce(userId: string, producerTransportId: string, rtpParameters: RtpParameters, kind: MediaKind): Promise<string>
  {
    try
    {
      const peer = this._peers.get(userId);
      if (!peer)
      {
        throw new Error(`Peer with id ${userId} not found`);
      }
      const producer = await peer.createProducer(producerTransportId, rtpParameters, kind);

      if (!producer)
      {
        throw new Error("Producer is undefined");
      }

      this.broadCast(userId, WebSocketEventType.NEW_PRODUCERS, [
        {
          producer_id: producer.id,
          userId: userId,
          kind: producer.kind,
        },
      ]);

      return producer.id;
    } catch (err)
    {
      console.error("Error in produce:", err);
      throw err;
    }
  }

  async consume(userId: string, socket_id: string, consumer_transport_id: string, producer_id: string, rtpCapabilities: RtpCapabilities)
  {
    this.ensureRouterInitialized();

    const routerCanConsume = this._router!.canConsume({
      producerId: producer_id,
      rtpCapabilities,
    });
    if (!routerCanConsume)
    {
      console.warn("Router cannot consume the given producer");
      return;
    }

    const peer = this._peers.get(userId);

    if (!peer)
    {
      console.warn("No Peer found with the given Id");
      return;
    }

    const consumer_created = await peer.createConsumer(consumer_transport_id, producer_id, rtpCapabilities);

    if (!consumer_created)
    {
      console.log("Couldn't create consumer");
      return;
    }

    const { consumer, params } = consumer_created;

    consumer.on("producerclose", () =>
    {
      console.log("Consumer closed due to close event in producer id", {
        name: peer.name,
        consumer_id: consumer.id,
      });

      peer.removeConsumer(consumer.id);

      this.io.to(socket_id).emit(WebSocketEventType.CONSUMER_CLOSED, {
        consumer_id: consumer.id,
      });
    });

    return params;
  }

  broadCast(socket_id: string, name: string, data: any)
  {
    for (let otherID of Array.from(this._peers.keys()).filter((id) => id !== socket_id))
    {
      this.send(otherID, name, data);
    }
  }

  send(socketId: string, name: string, data: any)
  {
    this.io.to(socketId).emit(name, data);
  }

  closeProducer(producer_id: string, socketId: string)
  {
    const peer = this._peers.get(socketId);
    if (!peer)
    {
      console.log("No peer found with the socket id");
      return;
    }
    peer.closeProducer(producer_id);
    // Remove from paused lists if present
    this._pausedVideoProducerIds.delete(producer_id);
    this._pausedAudioProducerIds.delete(producer_id);
    this.broadCast(socketId, WebSocketEventType.PRODUCER_CLOSED, {
      producer_id,
      userId: peer.id,
    });
    // Broadcast updated paused producer lists
    this.io.to(this.id).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, Array.from(this._pausedVideoProducerIds));
    this.io.to(this.id).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, Array.from(this._pausedAudioProducerIds));
    return;
  }

  addAndGetPausedVideoProducer(producerId: string): string[]
  {
    if (!producerId)
    {
      throw new Error("No producerId found in pause producer");
    }

    this._pausedVideoProducerIds.add(producerId);
    return Array.from(this._pausedVideoProducerIds);
  }

  removeAndGetPausedVideoProducer(producerId: string): string[]
  {
    if (!producerId)
    {
      throw new Error("No producerId found in pause producer");
    }

    if (!this._pausedVideoProducerIds.has(producerId))
    {
      console.warn("Paused video producer with this id not found");
      throw new Error("Paused video producer does not exist");
    }

    this._pausedVideoProducerIds.delete(producerId);
    return Array.from(this._pausedVideoProducerIds);
  }

  addAndGetPausedAudioProducer(producerId: string): string[]
  {
    if (!producerId)
    {
      throw new Error("No producerId found in pause audio producer");
    }

    this._pausedAudioProducerIds.add(producerId);
    return Array.from(this._pausedAudioProducerIds);
  }

  removeAndGetPausedAudioProducer(producerId: string): string[]
  {
    if (!producerId)
    {
      throw new Error("No producerId found in pause audio producer");
    }

    if (!this._pausedAudioProducerIds.has(producerId))
    {
      console.warn("Paused audio producer with this id not found");
      throw new Error("Paused audio producer does not exist");
    }

    this._pausedAudioProducerIds.delete(producerId);
    return Array.from(this._pausedAudioProducerIds);
  }

  getPausedVideoProducers(): string[]
  {
    return Array.from(this._pausedVideoProducerIds);
  }

  getPausedAudioProducers(): string[]
  {
    return Array.from(this._pausedAudioProducerIds);
  }
}