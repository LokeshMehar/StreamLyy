# ⚡ StreamLy – Real-time Media Infrastructure & Communication Fabric

StreamLy is a **high-performance, scalable communication infrastructure** for powering **real-time messaging**, **group video conferencing**, and **media synchronization** at scale.

Inspired by production systems like **Slack**, **Discord**, and **Zoom**, it demonstrates deep integration of distributed technologies such as **Kafka**, **Mediasoup**, **Redis**, and **WebSockets** — packaged into a seamless user-facing experience.

---

## 🚀 Key Capabilities

- 🔁 **Real-time Event Layer**  
  WebSocket-based message delivery pipeline backed by Kafka for resilience and high-throughput distribution.

- 🎥 **Video Conferencing Engine**  
  Mediasoup-powered SFU enables efficient, scalable multi-user WebRTC sessions with low latency and adaptive stream control.

- 📎 **Secure Media Storage**  
  AWS S3 integration with signed URL handling for secure file/media exchange and preview within conversations.

- ⚙️ **Session + Presence Management**  
  Redis provides fast, in-memory user session and connection tracking, powering dynamic UI feedback like online indicators and typing states.

- 💬 **Messaging Delivery + Replay**  
  Kafka ensures message durability, traceability, and ordered delivery with potential for analytics/logging via stream processing.

- 🧠 **Structured Data Layer**  
  PostgreSQL with Prisma ORM ensures normalized schema, referential integrity, and ease of evolution for relational data.

---

## 🧱 Tech Stack Overview

| Category            | Technology                         |
|---------------------|------------------------------------|
| **Backend Runtime** | Node.js, TypeScript                |
| **Database**        | PostgreSQL + Prisma ORM            |
| **Real-time Comm.** | WebSockets + Apache Kafka          |
| **Media Engine**    | Mediasoup (WebRTC SFU)             |
| **Session Layer**   | Redis                              |
| **File Storage**    | AWS S3 (signed upload/download)    |
| **Authentication**  | JWT (optionally OAuth2 compatible) |
| **DevOps**          | Docker, GitHub Actions, Postman    |

---

## 🧩 System Design Snapshot

```mermaid
graph LR
A[Client App] --> B(WebSocket Gateway)
B --> C(Kafka Broker)
B --> D(Mediasoup SFU)
B --> E(Redis Session Cache)
C --> F(Message Service)
F --> G(PostgreSQL DB)
F --> H(AWS S3)
