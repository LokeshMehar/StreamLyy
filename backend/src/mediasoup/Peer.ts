// src/mediasoup/Peer.ts
import { MediaKind, RtpCapabilities, Transport } from "mediasoup/node/lib/types";
import { Consumer, Producer } from "mediasoup/node/lib/types";
import { DtlsParameters, RtpParameters } from "mediasoup/node/lib/types";

export default class Peer
{
    id: string;
    name: string;
    private transport: Map<string, Transport>;
    private producers: Map<string, Producer>;
    private consumers: Map<string, Consumer>;

    constructor(id: string, name: string)
    {
        this.id = id;
        this.name = name;
        this.transport = new Map();
        this.producers = new Map();
        this.consumers = new Map();
    }

    addTransport(transport: Transport)
    {
        this.transport.set(transport.id, transport);
    }

    async connectTransport(transportId: string, dtlsParameters: DtlsParameters)
    {
        const transport = this.transport.get(transportId);
        if (!transport)
        {
            throw new Error("Transport not found");
        }
        await transport.connect({ dtlsParameters });
    }

    async createProducer(producerTransportId: string, rtpParameters: RtpParameters, kind: MediaKind)
    {
        const transport = this.transport.get(producerTransportId);
        if (!transport)
        {
            throw new Error("Producer transport not found");
        }
        let producer = await transport.produce({ rtpParameters, kind });
        this.producers.set(producer.id, producer);

        producer.on("transportclose", () =>
        {
            console.log("Producer transport closed", producer.id);
            producer.close();
            this.producers.delete(producer.id);
        });

        return producer;
    }

    async createConsumer(consumer_transport_id: string, producer_id: string, rtpCapabilities: RtpCapabilities)
    {
        let consumerTransport = this.transport.get(consumer_transport_id);
        if (!consumerTransport)
        {
            console.warn("Create a transport for the specified consumer first");
            return;
        }

        let consumer: Consumer;

        try
        {
            consumer = await consumerTransport.consume({
                producerId: producer_id,
                rtpCapabilities,
                paused: false,
            });
            console.log("Consumer successfully created");
        } catch (error)
        {
            console.error("Consume failed", error);
            return;
        }

        if (consumer.type === "simulcast")
        {
            await consumer.setPreferredLayers({
                spatialLayer: 2,
                temporalLayer: 2,
            });
        }

        this.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () =>
        {
            console.log("Consumer transport close", {
                name: `${this.name}`,
                consumer_id: `${consumer.id}`,
            });
            this.consumers.delete(consumer.id);
        });

        return {
            consumer,
            user: {
                id: this.id,
                name: this.name,
            },
            params: {
                producerId: producer_id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused,
            },
        };
    }

    closeProducer(producer_id: string)
    {
        const producer = this.producers.get(producer_id);
        if (!producer)
        {
            console.warn("Producer not found", producer_id);
            return;
        }
        try
        {
            producer.close();
        } catch (e)
        {
            console.warn("Error closing producer", e);
        }
        this.producers.delete(producer_id);
    }

    close()
    {
        this.transport.forEach((transport) => transport.close());
        this.producers.forEach((producer) => producer.close());
        this.consumers.forEach((consumer) => consumer.close());
        this.transport.clear();
        this.producers.clear();
        this.consumers.clear();
    }

    removeConsumer(consumerId: string)
    {
        const consumer = this.consumers.get(consumerId);
        if (consumer)
        {
            consumer.close();
            this.consumers.delete(consumerId);
        }
    }

    get_producers()
    {
        return this.producers;
    }

    get_transports()
    {
        return this.transport;
    }
}