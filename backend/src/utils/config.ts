import { RtpCodecCapability } from "mediasoup/node/lib/types";

export const config = {
    mediaSoup: {
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 10100,
        },
        router: {
            mediaCodecs: [
                {
                    kind: "audio" as const, // Use "as const" to narrow the type to "audio"
                    mimeType: "audio/opus",
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: "video" as const, // Use "as const" to narrow the type to "video"
                    mimeType: "video/VP8",
                    clockRate: 90000,
                    parameters: {
                        "x-google-start-bitrate": 1000,
                    },
                },
            ] as RtpCodecCapability[], // Explicitly type as RtpCodecCapability[]
        },
        webRTCTransport: {
            listenIps: [
                {
                    ip: "0.0.0.0",
                    announcedIp: "127.0.0.1",
                },
            ],
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        },
    },
};