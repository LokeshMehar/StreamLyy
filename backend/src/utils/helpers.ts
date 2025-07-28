// src/utils/helpers.ts
import * as mediasoup from "mediasoup";
import { config } from "./config";
import { Router } from "mediasoup/node/lib/RouterTypes";

export const createMediasoupWorker = async () =>
{
  try
  {
    const newWorker = await mediasoup.createWorker({
      rtcMinPort: config.mediaSoup.worker.rtcMinPort, // Align with config
      rtcMaxPort: config.mediaSoup.worker.rtcMaxPort,
    });

    console.log("Worker process id", newWorker.pid);

    newWorker.on("died", (error) =>
    {
      console.error("Mediasoup worker has died", error);

      setTimeout(() =>
      {
        process.exit(1);
      }, 2000);
    });

    return newWorker;
  } catch (error)
  {
    console.log("Something went wrong while creating a worker", error);
    throw error;
  }
};

export const createWebRTCTransport = async (mediasoupRouter: Router) =>
{
  const { maxIncomingBitrate, initialAvailableOutgoingBitrate, listenIps } = config.mediaSoup.webRTCTransport;

  const transport = await mediasoupRouter.createWebRtcTransport({
    listenIps: [...listenIps],
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
    } catch (error)
    {
      console.log("Error while setting max bitrate", error);
    }
  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
};