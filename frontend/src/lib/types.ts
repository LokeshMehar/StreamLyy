// // frontend/src/lib/types.ts

// export enum WebSocketEventType
// {
//   // ROOM EVENTS
//   CREATE_ROOM = "createRoom",
//   JOIN_ROOM = "joinRoom",
//   EXIT_ROOM = "exitRoom",
//   USER_LEFT = "userLeft",
//   USER_JOINED = "userJoined",
//   GET_IN_ROOM_USERS = "getInRoomUsers",

//   // ROOM CHAT
//   USER_CHAT = "userChatMessage",

//   ERROR = "error",
//   DISCONNECT = "disconnect",

//   CLOSE_PRODUCER = "closeProducer",

//   // Server-side events
//   GET_PRODUCERS = "getProducers",
//   GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",
//   CREATE_WEBRTC_TRANSPORT = "createWebRtcTransport",
//   CONNECT_TRANSPORT = "connectTransport",
//   PRODUCE = "produce",
//   CONSUME = "consume",
//   GET_MY_ROOM_INFO = "getMyRoomInfo",
//   PRODUCER_CLOSED = "producerClosed",
//   CONSUMER_CLOSED = "consumerClosed",
//   ADD_PAUSED_PRODUCER = "addPausedProducer",
//   REMOVE_PAUSED_PRODUCER = "removePausedProducer",
//   GET_PAUSED_PRODUCERS = "getPausedProducers", // Corrected typo from "getPauseProducers"
//   ADD_PAUSED_AUDIO_PRODUCER = "addPausedAudioProducer", // Align naming with backend
//   REMOVE_PAUSED_AUDIO_PRODUCER = "removePausedAudioProducer",
//   GET_PAUSED_AUDIO_PRODUCERS = "getPausedAudioProducers",

//   // Client-side events
//   ROOM_CREATED_MESSAGE = "createdRoom",
//   NEW_PRODUCERS = "newProducers",
//   PRODUCED = "produced",
//   ROUTER_RTP_CAPABILITIES = "routerRtpCapabilities",
//   CREATED_WEBRTC_TRANSPORT = "createdWebRtcTransport",
//   CONSUMED = "consumed",
//   ROOM_INFO = "roomInfo",
//   JOINED_ROOM_MESSAGE = "joinedRoom",
// }

// export interface WebSocketEvent
// {
//   type: WebSocketEventType;
//   payload: any;
//   socketId?: number;
// }



export enum WebSocketEventType
{
  // ROOM EVENTS
  JOIN_ROOM = "joinRoom",
  EXIT_ROOM = "exitRoom",
  USER_LEFT = "userLeft",
  USER_JOINED = "userJoined",
  GET_IN_ROOM_USERS = "getInRoomUsers",

  ERROR = "error",
  DISCONNECT = "disconnect",

  CLOSE_PRODUCER = "closeProducer",

  // Server-side events used by the frontend
  GET_PRODUCERS = "getProducers",
  GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",
  CREATE_WEBRTC_TRANSPORT = "createWebRtcTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
  PRODUCER_CLOSED = "producerClosed",
  CONSUMER_CLOSED = "consumerClosed",
  ADD_PAUSED_PRODUCER = "addPausedProducer",
  REMOVE_PAUSED_PRODUCER = "removePausedProducer",
  GET_PAUSED_PRODUCERS = "getPausedProducers",
  ADD_PAUSED_AUDIO_PRODUCER = "addPausedAudioProducer",
  REMOVE_PAUSED_AUDIO_PRODUCER = "removePausedAudioProducer",
  GET_PAUSED_AUDIO_PRODUCERS = "getPausedAudioProducers",

  // Client-side events used by the frontend
  NEW_PRODUCERS = "newProducers",

  // Added for restart call functionality
  RESTART_CALL = "restartCall",
}

export interface WebSocketEvent
{
  type: WebSocketEventType;
  payload: any;
  socketId?: number;
}