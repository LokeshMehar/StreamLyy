// export enum WebSocketEventType
// {
//     CREATE_ROOM = "create_room",
//     JOIN_ROOM = "join_room",
//     GET_ROUTER_RTP_CAPABILITIES = "get_router_rtp_capabilities",
//     GET_IN_ROOM_USERS = "get_in_room_users",
//     CREATE_WEBRTC_TRANSPORT = "create_webrtc_transport",
//     CONNECT_TRANSPORT = "connect_transport",
//     PRODUCE = "produce",
//     GET_PRODUCERS = "get_producers",
//     CONSUME = "consume",
//     EXIT_ROOM = "exit_room",
//     USER_JOINED = "user_joined",
//     NEW_PRODUCERS = "new_producers",
//     USER_LEFT = "user_left",
//     RESTART_CALL = "RESTART_CALL",
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

    // server side
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
    GET_PAUSED_PRODUCERS = "getPauseProducers",
    ADD_PAUSED_AUDIO_PRODUCER = "addPausedAudioProducer",
    REMOVE_PAUSED_AUDIO_PRODUCER = "removePausedAudioProducer",
    GET_PAUSED_AUDIO_PRODUCERS = "getPausedAudioProducers",

    // client side
    NEW_PRODUCERS = "newProducers",

    // Added for restart call functionality
    RESTART_CALL = "restartCall",
}