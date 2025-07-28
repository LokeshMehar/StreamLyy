import { Kafka, Producer, Consumer } from "kafkajs";
import fs from "fs";
import path from "path";
import prisma from "../utils/prisma";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const kafka = new Kafka({
  clientId: "chat-kafka",
  brokers: [process.env.KAFKA_BROKER || "lokeshm-kafka:9092"],
  ssl: process.env.KAFKA_SSL === "true" ? {
    rejectUnauthorized: true,
    ca: [fs.readFileSync(path.resolve("./ca.pem"), "utf-8")],
    cert: fs.readFileSync(path.resolve("./service.cert"), "utf-8"),
    key: fs.readFileSync(path.resolve("./service.key"), "utf-8"),
  } : false,
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
  },
});

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export const createProducer = async () =>
{
  if (producer) return producer;

  try
  {
    const producer_ = kafka.producer();
    await producer_.connect();
    producer = producer_;
    console.log("✅ Kafka producer connected");
    return producer;
  } catch (error)
  {
    console.error("Error creating Kafka producer:", error);
    throw error;
  }
};

export const produceMessage = async (message: string) =>
{
  try
  {
    const producer = await createProducer();
    await producer.send({
      topic: "MESSAGES",
      messages: [{ key: `message-${Date.now()}`, value: message }],
    });
    console.log("Message sent to Kafka:", message);
    return true;
  } catch (error)
  {
    console.error("Error sending message to Kafka:", error);
    return false;
  }
};

export const startMessageConsumer = async () =>
{
  if (consumer) return consumer;

  try
  {
    consumer = kafka.consumer({ groupId: "chat-consumer-group" });
    await consumer.connect();
    await consumer.subscribe({ topic: "MESSAGES", fromBeginning: true });
    console.log("✅ Kafka consumer connected and subscribed to MESSAGES topic");

    await consumer.run({
      eachMessage: async ({ message }) =>
      {
        try
        {
          const parsedMessage = JSON.parse(message.value?.toString() || "{}");
          const { content, imageUrl, chatId, senderId } = parsedMessage;

          const type = imageUrl ? "IMAGE" : "TEXT";

          await prisma.message.create({
            data: {
              content,
              chatId,
              senderId,
              imageUrl,
              type,
            },
          });
          console.log("✅ Message saved to database");
        } catch (error)
        {
          console.error("Error saving message to database:", error);
        }
      },
    });
    console.log("✅ Kafka consumer is listening for messages...");
  } catch (error)
  {
    console.error("Error initializing Kafka consumer:", error);
    // Attempt reconnection after delay
    setTimeout(startMessageConsumer, 5000);
  }
};

export const disconnectKafka = async () =>
{
  try
  {
    if (producer)
    {
      await producer.disconnect();
      producer = null;
      console.log("Kafka producer disconnected");
    }
    if (consumer)
    {
      await consumer.disconnect();
      consumer = null;
      console.log("Kafka consumer disconnected");
    }
  } catch (error)
  {
    console.error("Error disconnecting Kafka:", error);
  }
};