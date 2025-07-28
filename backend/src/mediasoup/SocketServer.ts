// src/mediasoup/SocketServer.ts
import * as io from "socket.io";
import Room from "./Room";
import { WebSocketEventType } from "./enums";
import dotenv from "dotenv";
import { createMediasoupWorker } from "../utils/helpers";

dotenv.config({
  path: "./.env",
});

interface SocketCallback
{
  (response: any): void;
}

declare module "socket.io" {
  interface Socket
  {
    roomId?: string;
    userId?: string;
  }
}

export class SocketService
{
  private _io: io.Server;
  private _roomList: Map<string, Room>;

  constructor(ioServer: io.Server)
  {
    console.log("Initializing socket server");
    console.log('Kafka brokers:', process.env.KAFKA_BROKER);

    this._io = ioServer;
    this._roomList = new Map();
    try
    {
      this.listenToWebSockets(this._io);
    } catch (error)
    {
      console.log("ERROR in socket", error);
    }
  }

  private listenToWebSockets(io: io.Server)
  {
    io.on("connection", (socket) =>
    {
      console.log("New connection:", socket.id);

      socket.on(WebSocketEventType.CREATE_ROOM, async ({ roomId }, cb: SocketCallback) =>
      {
        if (!roomId)
        {
          console.log("No room id provided!", socket.id);
          cb({ error: "No room id provided to create room" });
          return;
        }
        let room = this._roomList.get(roomId);

        if (!room)
        {
          const worker = await createMediasoupWorker();
          room = new Room(roomId, io, worker);
          await room.initialize(worker); // Ensure router is initialized
          this._roomList.set(roomId, room);
          console.log("Room created successfully!");
          cb({ message: "Room created successfully" });
        } else
        {
          console.log("Room with this id already exists");
          cb({ error: "Room with this id already exists" });
        }
      });

      socket.on(WebSocketEventType.JOIN_ROOM, async (data: { userId: string; roomId: string; name: string }, cb: SocketCallback) =>
      {
        const { userId, roomId, name } = data;

        if (!userId || !roomId || !name)
        {
          console.log("Missing Data in JOIN_ROOM", userId, name, roomId);
          cb({ error: "Missing data in JOIN_ROOM" });
          return;
        }

        let room = this._roomList.get(roomId);

        if (!room)
        {
          console.log("Room not found, creating a room");
          const worker = await createMediasoupWorker();
          room = new Room(roomId, io, worker);
          await room.initialize(worker); // Ensure router is initialized
          this._roomList.set(roomId, room);
        }

        room = this._roomList.get(roomId);

        if (!room)
        {
          cb({ error: "Failed to create or retrieve room" });
          return;
        }

        const peer = room.createPeer(name, userId);
        socket.roomId = roomId;
        socket.userId = userId;
        socket.join(roomId);
        socket.to(roomId).emit(WebSocketEventType.USER_JOINED, {
          message: `${name} joined the room`,
          user: peer,
        });

        console.log("Room joined successfully", { name, roomId });
        cb({
          message: "Room joined successfully",
          users: room.getCurrentPeers(userId),
        });

        // Send paused producer lists to the joining peer
        socket.emit(WebSocketEventType.GET_PAUSED_PRODUCERS, room.getPausedVideoProducers());
        socket.emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, room.getPausedAudioProducers());
      });

      socket.on(WebSocketEventType.EXIT_ROOM, ({ userId }, cb) =>
      {
        if (!userId || !socket.roomId)
        {
          console.log("Missing userId or not in a room", { userId, roomId: socket.roomId });
          cb({ error: "Not in a room" });
          return;
        }

        console.log("Inside the exit room", { userId, roomId: socket.roomId });
        const room = this._roomList.get(socket.roomId);
        if (!room)
        {
          console.log("Room does not exist");
          cb({ error: "Room does not exist" });
          return;
        }

        const peerData = room._peers.get(userId);
        if (!peerData)
        {
          console.log("Peer not found", userId);
          cb({ error: "Peer not found" });
          return;
        }
        const producersMap = peerData.get_producers();
        const producerIds = Array.from(producersMap.keys());

        console.log("The producer IDs are", producerIds);

        const peer = room.removePeer(userId);
        if (room._peers.size <= 0)
        {
          this._roomList.delete(room.id);
          console.log(`Room ${room.id} deleted as it is empty`);
        }

        socket.to(room.id).emit(WebSocketEventType.USER_LEFT, {
          message: `${peer?.name} left the room`,
          user: peer,
          leavingProducers: producerIds,
        });

        socket.roomId = undefined;
        socket.userId = undefined;
        socket.leave(room.id);
        console.log("Peer removed successfully!", peer);
        cb({ message: "Exited room successfully" });
      });

      socket.on(WebSocketEventType.DISCONNECT, () =>
      {
        console.log(`User Disconnected: ${socket.id}`);
        if (socket.roomId && socket.userId)
        {
          const room = this._roomList.get(socket.roomId);
          if (room)
          {
            const peerData = room._peers.get(socket.userId);
            if (peerData)
            {
              const producersMap = peerData.get_producers();
              const producerIds = Array.from(producersMap.keys());

              const peer = room.removePeer(socket.userId);
              if (room._peers.size <= 0)
              {
                this._roomList.delete(room.id);
                console.log(`Room ${room.id} deleted as it is empty`);
              }

              socket.to(room.id).emit(WebSocketEventType.USER_LEFT, {
                message: `${peer?.name} left the room`,
                user: peer,
                leavingProducers: producerIds,
              });
            }
          }
        }
        socket.roomId = undefined;
        socket.userId = undefined;
      });

      socket.on(WebSocketEventType.GET_IN_ROOM_USERS, (_, cb: SocketCallback) =>
      {
        const roomId = socket.roomId as string;
        const room = this._roomList.get(roomId);
        if (!room)
        {
          console.log("Room does not exist");
          cb({ error: "Room does not exist" });
          return;
        }
        cb({ users: room.getCurrentPeers(socket.userId!) });
        console.log("Current users sent!");
      });

      socket.on(WebSocketEventType.GET_PRODUCERS, (_, cb: SocketCallback) =>
      {
        const roomId = socket.roomId as string;
        const room = this._roomList.get(roomId);

        if (!room)
        {
          cb({ error: "Room does not exist" });
          console.log("Room does not exist");
          return;
        }

        let producerList = room.getProducerListForPeer();
        cb({ producerList });
        console.log("Successfully sent the producer list", producerList);
      });

      socket.on(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, (_, cb: SocketCallback) =>
      {
        const roomId = socket.roomId as string;
        const room = this._roomList.get(roomId);
        if (!room)
        {
          cb({ error: "Room does not exist" });
          console.log("Room does not exist");
          return;
        }
        const rtpCapabilities = room.getRtpCapabilities();
        cb({ rtpCapabilities });
        console.log("Sent the rtp capabilities", rtpCapabilities);
      });

      socket.on(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, async ({ userId }, cb: SocketCallback) =>
      {
        const room = this._roomList.get(socket.roomId!);
        if (!room)
        {
          console.log(WebSocketEventType.ERROR, "Couldn't find room");
          cb({ error: "Couldn't find room" });
          return;
        }

        const params = await room.createWebRtcTransport(userId);
        if (!params)
        {
          cb({ error: "Failed to create WebRTC transport" });
          return;
        }
        cb(params);
        console.log("Created transport, the params are", params);
      });

      socket.on(WebSocketEventType.CONNECT_TRANSPORT, async ({ userId, transportId, dtlsParameters }, cb: SocketCallback) =>
      {
        const room = this._roomList.get(socket.roomId!);
        if (!room)
        {
          console.log(WebSocketEventType.ERROR, "Couldn't find room");
          cb({ error: "Couldn't find room" });
          return;
        }

        await room.connectPeerTransport(userId, transportId, dtlsParameters);
        cb("Success");
      });

      socket.on(WebSocketEventType.PRODUCE, async ({ userId, kind, rtpParameters, producerTransportId }, cb: SocketCallback) =>
      {
        console.log("IN PRODUCE EVENT");

        const room = this._roomList.get(socket.roomId!);
        if (!room)
        {
          return cb({ error: "Couldn't find the room" });
        }

        let producer_id;
        try
        {
          producer_id = await room.produce(userId, producerTransportId, rtpParameters, kind);
        } catch (err)
        {
          return cb({ error: (err as Error).message });
        }

        const newProducers = [
          {
            producer_id,
            userId,
            kind,
          },
        ];

        socket.to(socket.roomId!).emit(WebSocketEventType.NEW_PRODUCERS, newProducers);
        cb({
          producer_id,
          userId,
        });
      });

      socket.on(WebSocketEventType.CLOSE_PRODUCER, ({ producer_id }, cb?: SocketCallback) =>
      {
        const room = this._roomList.get(socket.roomId!)!;
        console.log(WebSocketEventType.CLOSE_PRODUCER, producer_id);

        if (room)
        {
          room.closeProducer(producer_id, socket.userId!);
          if (cb)
          {
            cb({ success: true });
          }
        } else
        {
          if (cb)
          {
            cb({ error: "Room not found" });
          }
        }
      });

      socket.on(WebSocketEventType.CONSUME, async ({ userId, consumerTransportId, producerId, rtpCapabilities }, cb: SocketCallback) =>
      {
        const room = this._roomList.get(socket.roomId!);

        if (!room)
        {
          console.warn("No room associated with the id");
          cb({ error: "Room not found" });
          return;
        }

        const params = await room.consume(userId, socket.id, consumerTransportId, producerId, rtpCapabilities);

        if (!params)
        {
          console.log("Consumer params couldn't be passed");
          cb({ error: "Failed to create consumer" });
          return;
        }

        cb(params);
      });

      socket.on(WebSocketEventType.ADD_PAUSED_PRODUCER, ({ videoProducerId }, cb) =>
      {
        const room = this._roomList.get(socket.roomId!);

        if (!room)
        {
          console.warn("No room present!");
          cb({ error: "Room does not exist" });
          return;
        }

        if (!videoProducerId)
        {
          console.warn("No videoProducerId found");
          cb({ error: "Video ProducerId not found" });
          return;
        }

        let pausedProducers;
        try
        {
          pausedProducers = room.addAndGetPausedVideoProducer(videoProducerId);
        } catch (err)
        {
          cb({ error: (err as Error).message });
          return;
        }
        socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, pausedProducers);
        cb({ success: true });
      });

      socket.on(WebSocketEventType.REMOVE_PAUSED_PRODUCER, ({ videoProducerId }, cb) =>
      {
        const room = this._roomList.get(socket.roomId!);

        if (!room)
        {
          console.warn("No room present!");
          cb({ error: "Room does not exist" });
          return;
        }

        if (!videoProducerId)
        {
          console.warn("No videoProducerId found");
          cb({ error: "Video ProducerId not found" });
          return;
        }

        let pausedProducers;
        try
        {
          pausedProducers = room.removeAndGetPausedVideoProducer(videoProducerId);
        } catch (err)
        {
          cb({ error: (err as Error).message });
          return;
        }
        socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, pausedProducers);
        cb({ success: true });
      });

      socket.on(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, ({ audioProducerId }, cb) =>
      {
        const room = this._roomList.get(socket.roomId!);

        if (!room)
        {
          console.warn("No room present!");
          cb({ error: "Room does not exist" });
          return;
        }

        if (!audioProducerId)
        {
          console.warn("No audioProducerId found");
          cb({ error: "Audio ProducerId not found" });
          return;
        }

        let pausedAudioProducers;
        try
        {
          pausedAudioProducers = room.addAndGetPausedAudioProducer(audioProducerId);
        } catch (err)
        {
          cb({ error: (err as Error).message });
          return;
        }
        socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, pausedAudioProducers);
        cb({ success: true });
      });

      socket.on(WebSocketEventType.REMOVE_PAUSED_AUDIO_PRODUCER, ({ audioProducerId }, cb) =>
      {
        const room = this._roomList.get(socket.roomId!);

        if (!room)
        {
          console.warn("No room present!");
          cb({ error: "Room does not exist" });
          return;
        }

        if (!audioProducerId)
        {
          console.warn("No audioProducerId found");
          cb({ error: "Audio ProducerId not found" });
          return;
        }

        let pausedAudioProducers;
        try
        {
          pausedAudioProducers = room.removeAndGetPausedAudioProducer(audioProducerId);
        } catch (err)
        {
          cb({ error: (err as Error).message });
          return;
        }
        socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, pausedAudioProducers);
        cb({ success: true });
      });
    });
  }
}








// import * as io from "socket.io";
// import Room from "./Room";
// import { WebSocketEventType } from "./enums";
// import dotenv from "dotenv";
// import { createMediasoupWorker } from "../utils/helpers";

// dotenv.config({
//   path: "./.env",
// });

// interface SocketCallback
// {
//   (response: any): void;
// }

// declare module "socket.io" {
//   interface Socket
//   {
//     roomId?: string;
//     userId?: string;
//   }
// }

// export class SocketService
// {
//   private _io: io.Server;
//   private _roomList: Map<string, Room>;

//   constructor(ioServer: io.Server)
//   {
//     console.log("Initializing socket server");
//     this._io = ioServer;
//     this._roomList = new Map();
//     try
//     {
//       this.listenToWebSockets(this._io);
//     } catch (error)
//     {
//       console.log("ERROR in socket", error);
//     }
//   }

//   private listenToWebSockets(io: io.Server)
//   {
//     io.on("connection", (socket) =>
//     {
//       console.log("New connection:", socket.id);

//       socket.on(WebSocketEventType.CREATE_ROOM, async ({ roomId }, cb: SocketCallback) =>
//       {
//         if (!roomId)
//         {
//           console.log("No room id provided!", socket.id);
//           cb({ error: "No room id provided to create room" });
//           return;
//         }
//         let room = this._roomList.get(roomId);

//         if (!room)
//         {
//           const worker = await createMediasoupWorker();
//           room = new Room(roomId, io, worker);
//           await room.initialize(worker); // Ensure router is initialized
//           this._roomList.set(roomId, room);
//           console.log("Room created successfully!");
//           cb({ message: "Room created successfully" });
//         } else
//         {
//           console.log("Room with this id already exists");
//           cb({ error: "Room with this id already exists" });
//         }
//       });

//       socket.on(WebSocketEventType.JOIN_ROOM, async (data: { userId: string; roomId: string; name: string }, cb: SocketCallback) =>
//       {
//         const { userId, roomId, name } = data;

//         if (!userId || !roomId || !name)
//         {
//           console.log("Missing Data in JOIN_ROOM", userId, name, roomId);
//           cb({ error: "Missing data in JOIN_ROOM" });
//           return;
//         }

//         let room = this._roomList.get(roomId);

//         if (!room)
//         {
//           console.log("Room not found, creating a room");
//           const worker = await createMediasoupWorker();
//           room = new Room(roomId, io, worker);
//           await room.initialize(worker); // Ensure router is initialized
//           this._roomList.set(roomId, room);
//         }

//         room = this._roomList.get(roomId);

//         if (!room)
//         {
//           cb({ error: "Failed to create or retrieve room" });
//           return;
//         }

//         // Close all existing producers in the room before restarting the call
//         const peers = room._peers;
//         const producerIdsToClose: string[] = [];
//         peers.forEach((peer) =>
//         {
//           const producers = peer.get_producers();
//           producers.forEach((_, producerId) =>
//           {
//             producerIdsToClose.push(producerId);
//             room.closeProducer(producerId, peer.id);
//           });
//         });

//         // Notify all users (including the joining user) to restart the call
//         io.in(roomId).emit(WebSocketEventType.RESTART_CALL, { producerIds: producerIdsToClose });

//         // Add the new peer to the room
//         const peer = room.createPeer(name, userId);
//         socket.roomId = roomId;
//         socket.userId = userId;
//         socket.join(roomId);

//         // Emit USER_JOINED to all other users
//         socket.to(roomId).emit(WebSocketEventType.USER_JOINED, {
//           message: `${name} joined the room`,
//           user: peer,
//         });

//         console.log("Room joined successfully", { name, roomId });
//         cb({
//           message: "Room joined successfully",
//           users: room.getCurrentPeers(userId),
//           pausedVideoProducerIds: room.getPausedVideoProducers(),
//           pausedAudioProducerIds: room.getPausedAudioProducers(),
//         });

//         // Send paused producer lists to the joining peer
//         socket.emit(WebSocketEventType.GET_PAUSED_PRODUCERS, room.getPausedVideoProducers());
//         socket.emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, room.getPausedAudioProducers());
//       });

//       socket.on(WebSocketEventType.EXIT_ROOM, ({ userId }, cb) =>
//       {
//         if (!userId || !socket.roomId)
//         {
//           console.log("Missing userId or not in a room", { userId, roomId: socket.roomId });
//           cb({ error: "Not in a room" });
//           return;
//         }

//         console.log("Inside the exit room", { userId, roomId: socket.roomId });
//         const room = this._roomList.get(socket.roomId);
//         if (!room)
//         {
//           console.log("Room does not exist");
//           cb({ error: "Room does not exist" });
//           return;
//         }

//         const peerData = room._peers.get(userId);
//         if (!peerData)
//         {
//           console.log("Peer not found", userId);
//           cb({ error: "Peer not found" });
//           return;
//         }
//         const producersMap = peerData.get_producers();
//         const producerIds = Array.from(producersMap.keys());

//         console.log("The producer IDs are", producerIds);

//         const peer = room.removePeer(userId);
//         if (room._peers.size <= 0)
//         {
//           this._roomList.delete(room.id);
//           console.log(`Room ${room.id} deleted as it is empty`);
//         }

//         socket.to(room.id).emit(WebSocketEventType.USER_LEFT, {
//           message: `${peer?.name} left the room`,
//           user: peer,
//           leavingProducers: producerIds,
//         });

//         socket.roomId = undefined;
//         socket.userId = undefined;
//         socket.leave(room.id);
//         console.log("Peer removed successfully!", peer);
//         cb({ message: "Exited room successfully" });
//       });

//       socket.on(WebSocketEventType.DISCONNECT, () =>
//       {
//         console.log(`User Disconnected: ${socket.id}`);
//         if (socket.roomId && socket.userId)
//         {
//           const room = this._roomList.get(socket.roomId);
//           if (room)
//           {
//             const peerData = room._peers.get(socket.userId);
//             if (peerData)
//             {
//               const producersMap = peerData.get_producers();
//               const producerIds = Array.from(producersMap.keys());

//               const peer = room.removePeer(socket.userId);
//               if (room._peers.size <= 0)
//               {
//                 this._roomList.delete(room.id);
//                 console.log(`Room ${room.id} deleted as it is empty`);
//               }

//               socket.to(room.id).emit(WebSocketEventType.USER_LEFT, {
//                 message: `${peer?.name} left the room`,
//                 user: peer,
//                 leavingProducers: producerIds,
//               });
//             }
//           }
//         }
//         socket.roomId = undefined;
//         socket.userId = undefined;
//       });

//       socket.on(WebSocketEventType.GET_IN_ROOM_USERS, (_, cb: SocketCallback) =>
//       {
//         const roomId = socket.roomId as string;
//         const room = this._roomList.get(roomId);
//         if (!room)
//         {
//           console.log("Room does not exist");
//           cb({ error: "Room does not exist" });
//           return;
//         }
//         cb({ users: room.getCurrentPeers(socket.userId!) });
//         console.log("Current users sent!");
//       });

//       socket.on(WebSocketEventType.GET_PRODUCERS, (_, cb: SocketCallback) =>
//       {
//         const roomId = socket.roomId as string;
//         const room = this._roomList.get(roomId);

//         if (!room)
//         {
//           cb({ error: "Room does not exist" });
//           console.log("Room does not exist");
//           return;
//         }

//         let producerList = room.getProducerListForPeer();
//         cb({ producerList });
//         console.log("Successfully sent the producer list", producerList);
//       });

//       socket.on(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, (_, cb: SocketCallback) =>
//       {
//         const roomId = socket.roomId as string;
//         const room = this._roomList.get(roomId);
//         if (!room)
//         {
//           cb({ error: "Room does not exist" });
//           console.log("Room does not exist");
//           return;
//         }
//         const rtpCapabilities = room.getRtpCapabilities();
//         cb({ rtpCapabilities });
//         console.log("Sent the rtp capabilities", rtpCapabilities);
//       });

//       socket.on(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, async ({ userId }, cb: SocketCallback) =>
//       {
//         const room = this._roomList.get(socket.roomId!);
//         if (!room)
//         {
//           console.log(WebSocketEventType.ERROR, "Couldn't find room");
//           cb({ error: "Couldn't find room" });
//           return;
//         }

//         const params = await room.createWebRtcTransport(userId);
//         if (!params)
//         {
//           cb({ error: "Failed to create WebRTC transport" });
//           return;
//         }
//         cb(params);
//         console.log("Created transport, the params are", params);
//       });

//       socket.on(WebSocketEventType.CONNECT_TRANSPORT, async ({ userId, transportId, dtlsParameters }, cb: SocketCallback) =>
//       {
//         const room = this._roomList.get(socket.roomId!);
//         if (!room)
//         {
//           console.log(WebSocketEventType.ERROR, "Couldn't find room");
//           cb({ error: "Couldn't find room" });
//           return;
//         }

//         await room.connectPeerTransport(userId, transportId, dtlsParameters);
//         cb("Success");
//       });

//       socket.on(WebSocketEventType.PRODUCE, async ({ userId, kind, rtpParameters, producerTransportId }, cb: SocketCallback) =>
//       {
//         console.log("IN PRODUCE EVENT");

//         const room = this._roomList.get(socket.roomId!);
//         if (!room)
//         {
//           return cb({ error: "Couldn't find the room" });
//         }

//         let producer_id;
//         try
//         {
//           producer_id = await room.produce(userId, producerTransportId, rtpParameters, kind);
//         } catch (err)
//         {
//           return cb({ error: (err as Error).message });
//         }

//         const newProducers = [
//           {
//             producer_id,
//             userId,
//             kind,
//           },
//         ];

//         socket.to(socket.roomId!).emit(WebSocketEventType.NEW_PRODUCERS, newProducers);
//         cb({
//           producer_id,
//           userId,
//         });
//       });

//       socket.on(WebSocketEventType.CLOSE_PRODUCER, ({ producer_id }, cb?: SocketCallback) =>
//       {
//         const room = this._roomList.get(socket.roomId!)!;
//         console.log(WebSocketEventType.CLOSE_PRODUCER, producer_id);

//         if (room)
//         {
//           room.closeProducer(producer_id, socket.userId!);
//           if (cb)
//           {
//             cb({ success: true });
//           }
//         } else
//         {
//           if (cb)
//           {
//             cb({ error: "Room not found" });
//           }
//         }
//       });

//       socket.on(WebSocketEventType.CONSUME, async ({ userId, consumerTransportId, producerId, rtpCapabilities }, cb: SocketCallback) =>
//       {
//         const room = this._roomList.get(socket.roomId!);

//         if (!room)
//         {
//           console.warn("No room associated with the id");
//           cb({ error: "Room not found" });
//           return;
//         }

//         const params = await room.consume(userId, socket.id, consumerTransportId, producerId, rtpCapabilities);

//         if (!params)
//         {
//           console.log("Consumer params couldn't be passed");
//           cb({ error: "Failed to create consumer" });
//           return;
//         }

//         cb(params);
//       });

//       socket.on(WebSocketEventType.ADD_PAUSED_PRODUCER, ({ videoProducerId }, cb) =>
//       {
//         const room = this._roomList.get(socket.roomId!);

//         if (!room)
//         {
//           console.warn("No room present!");
//           cb({ error: "Room does not exist" });
//           return;
//         }

//         if (!videoProducerId)
//         {
//           console.warn("No videoProducerId found");
//           cb({ error: "Video ProducerId not found" });
//           return;
//         }

//         let pausedProducers;
//         try
//         {
//           pausedProducers = room.addAndGetPausedVideoProducer(videoProducerId);
//         } catch (err)
//         {
//           cb({ error: (err as Error).message });
//           return;
//         }
//         socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, pausedProducers);
//         cb({ success: true });
//       });

//       socket.on(WebSocketEventType.REMOVE_PAUSED_PRODUCER, ({ videoProducerId }, cb) =>
//       {
//         const room = this._roomList.get(socket.roomId!);

//         if (!room)
//         {
//           console.warn("No room present!");
//           cb({ error: "Room does not exist" });
//           return;
//         }

//         if (!videoProducerId)
//         {
//           console.warn("No videoProducerId found");
//           cb({ error: "Video ProducerId not found" });
//           return;
//         }

//         let pausedProducers;
//         try
//         {
//           pausedProducers = room.removeAndGetPausedVideoProducer(videoProducerId);
//         } catch (err)
//         {
//           cb({ error: (err as Error).message });
//           return;
//         }
//         socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_PRODUCERS, pausedProducers);
//         cb({ success: true });
//       });

//       socket.on(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, ({ audioProducerId }, cb) =>
//       {
//         const room = this._roomList.get(socket.roomId!);

//         if (!room)
//         {
//           console.warn("No room present!");
//           cb({ error: "Room does not exist" });
//           return;
//         }

//         if (!audioProducerId)
//         {
//           console.warn("No audioProducerId found");
//           cb({ error: "Audio ProducerId not found" });
//           return;
//         }

//         let pausedAudioProducers;
//         try
//         {
//           pausedAudioProducers = room.addAndGetPausedAudioProducer(audioProducerId);
//         } catch (err)
//         {
//           cb({ error: (err as Error).message });
//           return;
//         }
//         socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, pausedAudioProducers);
//         cb({ success: true });
//       });

//       socket.on(WebSocketEventType.REMOVE_PAUSED_AUDIO_PRODUCER, ({ audioProducerId }, cb) =>
//       {
//         const room = this._roomList.get(socket.roomId!);

//         if (!room)
//         {
//           console.warn("No room present!");
//           cb({ error: "Room does not exist" });
//           return;
//         }

//         if (!audioProducerId)
//         {
//           console.warn("No audioProducerId found");
//           cb({ error: "Audio ProducerId not found" });
//           return;
//         }

//         let pausedAudioProducers;
//         try
//         {
//           pausedAudioProducers = room.removeAndGetPausedAudioProducer(audioProducerId);
//         } catch (err)
//         {
//           cb({ error: (err as Error).message });
//           return;
//         }
//         socket.to(socket.roomId!).emit(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, pausedAudioProducers);
//         cb({ success: true });
//       });
//     });
//   }
// }