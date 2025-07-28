// // frontend/src/app/sample/[id]/page.tsx
// 'use client'

// import { io } from "socket.io-client";
// import { Device } from 'mediasoup-client';
// import { useParams, useRouter } from "next/navigation";
// import { useMemo, useEffect, useState, useRef } from "react";
// import { Toaster, toast } from "sonner";
// import useAuth from "@/hooks/useAuth";
// import { WebSocketEventType } from "@/lib/types";
// import {
//   DtlsParameters,
//   IceCandidate,
//   IceParameters,
//   MediaKind,
//   Producer,
//   Transport,
//   Consumer,
//   RtpCapabilities,
// } from "mediasoup-client/lib/types";
// import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

// // Types and interfaces
// interface WebRtcTransportParams {
//   id: string;
//   iceParameters: IceParameters;
//   iceCandidates: IceCandidate[];
//   dtlsParameters: DtlsParameters;
// }

// interface ProducerContainer {
//   producer_id: string;
//   userId: string;
//   kind: MediaKind;
// }

// interface Peer {
//   id: string;
//   name: string;
// }

// interface RemoteStream {
//   consumer: Consumer;
//   stream: MediaStream;
//   kind: MediaKind;
//   producerId: string;
//   userId: string;
// }

// export default function Page() {
//   const { id: roomId } = useParams();
//   const router = useRouter();
//   const { isAuthenticated, isLoading } = useAuth();

//   const localStreamRef = useRef<HTMLVideoElement | null>(null);
//   const localStreamTracksRef = useRef<MediaStreamTrack[]>([]);
//   const audioProducerRef = useRef<Producer | null>(null);
//   const videoProducerRef = useRef<Producer | null>(null);
//   const deviceRef = useRef<Device | null>(null);
//   const consumerTransportRef = useRef<Transport | null>(null);
//   const producerTransportRef = useRef<Transport | null>(null);
//   const consumers = useRef<Map<string, Consumer>>(new Map());
//   const consumedProducers = useRef<Set<string>>(new Set());
//   const callActiveRef = useRef<boolean>(false);

//   const [userId, setUserId] = useState<string | undefined>();
//   const [username, setUsername] = useState<string | undefined>();
//   const [isTabLocked, setIsTabLocked] = useState<boolean>(false);
//   const [producers, setProducers] = useState<ProducerContainer[]>([]);
//   const [isMicOn, setIsMicOn] = useState<boolean>(true);
//   const [isVideoOn, setIsVideoOn] = useState<boolean>(true);
//   const [usersInRoom, setUsersInRoom] = useState<Peer[]>([]);
//   const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
//   const [pausedVideoProducerIds, setPausedVideoProducerIds] = useState<string[]>([]);
//   const [pausedAudioProducerIds, setPausedAudioProducerIds] = useState<string[]>([]);

//   const socket = useMemo(() =>
//     io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`, {
//       withCredentials: true,
//     }), []
//   );

//   useEffect(() => {
//     if (isAuthenticated === false && !isLoading) {
//       toast.error("You are not logged in");
//       router.replace("/login");
//     }
//   }, [isAuthenticated, isLoading, router]);

//   useEffect(() => {
//     const storedUserId = localStorage.getItem("userId");
//     const storedName = localStorage.getItem("username");
//     if (!storedUserId || !storedName) {
//       toast.error("User not found. Redirecting to login.");
//       router.replace("/login");
//       return;
//     }
//     setUserId(storedUserId);
//     setUsername(storedName);
//   }, [router]);

//   useEffect(() => {
//     const lockKey = `call_lock_${roomId}`;
//     const acquireLock = () => {
//       const existingLock = localStorage.getItem(lockKey);
//       if (existingLock) {
//         setIsTabLocked(true);
//         toast.error("This call is already open in another tab. Please use that tab or close it to continue here.");
//         return false;
//       }
//       localStorage.setItem(lockKey, "locked");
//       window.addEventListener("unload", releaseLock);
//       return true;
//     };

//     const releaseLock = () => {
//       localStorage.removeItem(lockKey);
//     };

//     if (!acquireLock()) {
//       return;
//     }

//     return () => {
//       releaseLock();
//       window.removeEventListener("unload", releaseLock);
//     };
//   }, [roomId]);

//   useEffect(() => {
//     if (!isAuthenticated || isLoading || !userId || !username || isTabLocked || callActiveRef.current) {
//       return;
//     }

//     const init = async () => {
//       callActiveRef.current = true;
//       try {
//         await loadEverything();
//         await startStreaming();
//       } catch (error) {
//         console.error("Initialization failed:", error);
//         toast.error("Failed to start call. Redirecting to home.");
//         router.push("/home");
//       }
//     };

//     init();

//     const routeIncomingEvents = ({ event, args }: { event: WebSocketEventType; args: any }) => {
//       switch (event) {
//         case WebSocketEventType.USER_JOINED:
//           userJoined(args);
//           break;
//         case WebSocketEventType.USER_LEFT:
//           userLeft(args);
//           break;
//         case WebSocketEventType.NEW_PRODUCERS:
//           newProducers(args);
//           break;
//         case WebSocketEventType.PRODUCER_CLOSED:
//           closedProducers(args);
//           break;
//         case WebSocketEventType.CONSUMER_CLOSED:
//           consumerClosed(args);
//           break;
//         default:
//           break;
//       }
//     };

//     socket.onAny(routeIncomingEvents);

//     const handleBeforeUnload = (event: BeforeUnloadEvent) => {
//       // Synchronous cleanup for critical resources
//       localStreamTracksRef.current.forEach((track) => track.stop());
//       if (videoProducerRef.current) {
//         sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: videoProducerRef.current.id }).catch((err) =>
//           console.error("Error closing video producer on unload:", err)
//         );
//         videoProducerRef.current.close();
//       }
//       if (audioProducerRef.current) {
//         sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: audioProducerRef.current.id }).catch((err) =>
//           console.error("Error closing audio producer on unload:", err)
//         );
//         audioProducerRef.current.close();
//       }
//       if (userId) {
//         sendRequest(WebSocketEventType.EXIT_ROOM, { userId }).catch((err) =>
//           console.error("Error exiting room on unload:", err)
//         );
//       }
//       socket.disconnect();
//       event.preventDefault();
//       event.returnValue = '';
//     };

//     window.addEventListener("beforeunload", handleBeforeUnload);

//     return () => {
//       window.removeEventListener("beforeunload", handleBeforeUnload);
//       socket.offAny(routeIncomingEvents);
//       handleEndCall();
//       callActiveRef.current = false;
//     };
//   }, [isAuthenticated, isLoading, userId, username, isTabLocked, socket, router, roomId]);

//   useEffect(() => {
//     const getPausedProducers = (pausedProducers: string[]) => {
//       setPausedVideoProducerIds(pausedProducers || []);
//     };

//     socket.on(WebSocketEventType.GET_PAUSED_PRODUCERS, getPausedProducers);

//     return () => {
//       socket.off(WebSocketEventType.GET_PAUSED_PRODUCERS, getPausedProducers);
//     };
//   }, [socket]);

//   useEffect(() => {
//     const getPausedAudioProducers = (pausedProducers: string[]) => {
//       setPausedAudioProducerIds(pausedProducers || []);
//     };

//     socket.on(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, getPausedAudioProducers);

//     return () => {
//       socket.off(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, getPausedAudioProducers);
//     };
//   }, [socket]);

//   useEffect(() => {
//     const handleConsumerCleanup = (producerId: string) => {
//       setRemoteStreams((prev) => prev.filter((stream) => stream.producerId !== producerId));
//       consumedProducers.current.delete(producerId);
//     };

//     socket.on(WebSocketEventType.PRODUCER_CLOSED, ({ producer_id }: { producer_id: string }) => {
//       handleConsumerCleanup(producer_id);
//     });

//     return () => {
//       socket.off(WebSocketEventType.PRODUCER_CLOSED, handleConsumerCleanup);
//     };
//   }, [socket]);

//   useEffect(() => {
//   if (producers.length === 0 || !consumerTransportRef.current || !deviceRef.current) {
//     return;
//   }

//   const consumeNewProducers = async () => {
//     // Filter out the sender's own producers
//     const unconsumedProducers = producers.filter(
//       (producer) =>
//         !consumedProducers.current.has(producer.producer_id) &&
//         producer.userId !== userId // Exclude sender's own producers
//     );
//     for (const producer of unconsumedProducers) {
//       await consume(producer);
//       consumedProducers.current.add(producer.producer_id);
//     }
//   };

//   consumeNewProducers().catch((error) => {
//     console.error("Error consuming new producers:", error);
//   });
// }, [producers, userId]); // Add userId as a dependency

//   const sendRequest = (eventType: string, data: any): Promise<any> => {
//     return new Promise((resolve, reject) => {
//       socket.emit(eventType, data, (response: any) => {
//         if (response?.error) {
//           reject(new Error(response.error));
//         } else {
//           resolve(response);
//         }
//       });
//     });
//   };

//   const joinRoom = async () => {
//     try {
//       const response = await sendRequest(WebSocketEventType.JOIN_ROOM, {
//         userId,
//         roomId,
//         name: username,
//       });
//       setUsersInRoom(response.users || []);
//       setPausedVideoProducerIds(response.pausedVideoProducerIds || []);
//       setPausedAudioProducerIds(response.pausedAudioProducerIds || []);
//       return response;
//     } catch (error) {
//       console.error("Error joining room:", error);
//       throw error;
//     }
//   };

//   const getRtpCapabilities = async (retries = 3, delay = 1000): Promise<any> => {
//     for (let attempt = 1; attempt <= retries; attempt++) {
//       try {
//         const response = await sendRequest(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, {});
//         if (!response?.rtpCapabilities) {
//           throw new Error("Invalid or missing routerRtpCapabilities from server");
//         }

//         const device = new Device();
//         deviceRef.current = device;
//         await device.load({ routerRtpCapabilities: response.rtpCapabilities });
//         return response;
//       } catch (error) {
//         console.error(`getRtpCapabilities attempt ${attempt} failed:`, error);
//         if (attempt === retries) {
//           throw error;
//         }
//         await new Promise((resolve) => setTimeout(resolve, delay));
//       }
//     }
//     throw new Error("Failed to get RTP capabilities after all retries");
//   };

//   const getCurrentUsers = async () => {
//     try {
//       const response = await sendRequest(WebSocketEventType.GET_IN_ROOM_USERS, {});
//       setUsersInRoom(response.users || []);
//       return response;
//     } catch (error) {
//       console.error("Error getting current users:", error);
//       throw error;
//     }
//   };

//   const createProducerTransport = async () => {
//     if (!deviceRef.current) {
//       throw new Error("Device not initialized");
//     }

//     try {
//       const response = await sendRequest(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, {
//         userId,
//       }) as { params: WebRtcTransportParams };

//       producerTransportRef.current = deviceRef.current.createSendTransport(response.params);

//       producerTransportRef.current.on("connect", async ({ dtlsParameters }, cb, eb) => {
//         try {
//           await sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
//             userId,
//             transportId: producerTransportRef.current!.id,
//             dtlsParameters,
//           });
//           cb();
//         } catch (error) {
//           console.error("Error connecting producer transport:", error);
//           eb(error as Error);
//         }
//       });

//       producerTransportRef.current.on("produce", async ({ kind, rtpParameters }, cb, eb) => {
//         try {
//           const { producer_id } = await sendRequest(WebSocketEventType.PRODUCE, {
//             userId,
//             producerTransportId: producerTransportRef.current!.id,
//             kind,
//             rtpParameters,
//           }) as { producer_id: string };
//           cb({ id: producer_id });
//         } catch (error) {
//           console.error("Error in produce:", error);
//           eb(error as Error);
//         }
//       });

//       producerTransportRef.current.on("connectionstatechange", (state) => {
//         if (state === "disconnected") {
//           producerTransportRef.current?.close();
//         }
//       });

//       return true;
//     } catch (error) {
//       console.error("Error creating producer transport:", error);
//       throw error;
//     }
//   };

//   const createConsumerTransport = async () => {
//     try {
//       if (consumerTransportRef.current) {
//         return;
//       }

//       const data = await sendRequest(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, {
//         userId,
//       }) as { params: WebRtcTransportParams };

//       if (!deviceRef.current) {
//         throw new Error("Device not initialized");
//       }

//       consumerTransportRef.current = deviceRef.current.createRecvTransport(data.params);

//       consumerTransportRef.current.on("connect", async ({ dtlsParameters }, cb, eb) => {
//         try {
//           await sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
//             userId,
//             transportId: consumerTransportRef.current?.id,
//             dtlsParameters,
//           });
//           cb();
//         } catch (error) {
//           console.error("Error connecting consumer transport:", error);
//           eb(error as Error);
//         }
//       });

//       consumerTransportRef.current.on("connectionstatechange", (state) => {
//         if (state === "disconnected") {
//           consumerTransportRef.current?.close();
//         }
//       });
//     } catch (error) {
//       console.error("Error creating consumer transport:", error);
//       throw error;
//     }
//   };

//   const getProducersList = async () => {
//     try {
//       const { producerList } = await sendRequest(WebSocketEventType.GET_PRODUCERS, {});
//       if (producerList?.length > 0) {
//         setProducers(producerList);
//       }
//     } catch (error) {
//       console.error("Error getting producers:", error);
//     }
//   };

//   const consume = async (producer: ProducerContainer) => {
//     try {
//       const data = await consumeProducers(producer.producer_id, producer.kind);
//       if (!data) {
//         return;
//       }

//       const { consumer, stream, kind, producerId } = data;
//       if (!userId) {
//         return;
//       }

//       consumers.current.set(producerId, consumer);

//       setRemoteStreams((prev) => {
//         const existingStream = prev.find((s) => s.producerId === producerId && s.kind === kind);
//         if (existingStream) {
//           return prev;
//         }
//         return [...prev, { consumer, stream, kind, producerId, userId: producer.userId }];
//       });
//     } catch (error) {
//       console.error("Error consuming producer:", producer.producer_id, error);
//     }
//   };

//   const consumeProducers = async (producerId: string, kind: MediaKind): Promise<RemoteStream | null> => {
//     if (!deviceRef.current || !consumerTransportRef.current) {
//       return null;
//     }

//     try {
//       const rtpCapabilities = deviceRef.current.rtpCapabilities;
//       const data = await sendRequest(WebSocketEventType.CONSUME, {
//         userId,
//         rtpCapabilities,
//         consumerTransportId: consumerTransportRef.current.id,
//         producerId,
//       });

//       const { id, rtpParameters } = data;

//       const consumer = await consumerTransportRef.current.consume({
//         id,
//         producerId,
//         kind,
//         rtpParameters,
//       });

//       const stream = new MediaStream();
//       stream.addTrack(consumer.track);

//       return {
//         consumer,
//         stream,
//         kind,
//         producerId,
//         userId: userId!,
//       };
//     } catch (error) {
//       console.error("Error consuming producer:", producerId, error);
//       return null;
//     }
//   };

//   const loadEverything = async () => {
//     try {
//       // Join room and get initial state
//       const joinResponse = await joinRoom();
//       await getRtpCapabilities();
//       // Ensure users and producers are fully loaded
//       await Promise.all([getCurrentUsers(), createConsumerTransport(), createProducerTransport(), getProducersList()]);
//       // Double-check producers after all setup
//       await getProducersList();
//     } catch (error) {
//       console.error("Error loading everything:", error);
//       throw error;
//     }
//   };

//   const startStreaming = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true,
//       });

//       const videoTrack = stream.getVideoTracks()[0];
//       const audioTrack = stream.getAudioTracks()[0];

//       localStreamTracksRef.current = [videoTrack, audioTrack];

//       if (localStreamRef.current) {
//         localStreamRef.current.srcObject = stream;
//       }

//       if (!producerTransportRef.current) {
//         throw new Error("Producer transport not initialized");
//       }

//       const videoProducer = await producerTransportRef.current.produce({ track: videoTrack });
//       const audioProducer = await producerTransportRef.current.produce({ track: audioTrack });

//       videoProducerRef.current = videoProducer;
//       audioProducerRef.current = audioProducer;

//       if (!isVideoOn && videoProducer) {
//         videoProducer.pause();
//         await sendRequest(WebSocketEventType.ADD_PAUSED_PRODUCER, { videoProducerId: videoProducer.id });
//       }

//       if (!isMicOn && audioProducer) {
//         audioProducer.pause();
//         await sendRequest(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, { audioProducerId: audioProducer.id });
//       }

//       await getProducersList();
//     } catch (error) {
//       console.error("Error starting streaming:", error);
//       toast.error("Failed to start streaming");
//       throw error;
//     }
//   };

//   const toggleMic = async () => {
//     try {
//       if (!audioProducerRef.current) {
//         throw new Error("No audio producer available");
//       }

//       const audioProducerId = audioProducerRef.current.id;

//       if (isMicOn) {
//         audioProducerRef.current.pause();
//         await sendRequest(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, { audioProducerId });
//         setIsMicOn(false);
//         toast.success("Microphone muted");
//       } else {
//         audioProducerRef.current.resume();
//         await sendRequest(WebSocketEventType.REMOVE_PAUSED_AUDIO_PRODUCER, { audioProducerId });
//         setIsMicOn(true);
//         toast.success("Microphone unmuted");
//       }
//     } catch (error) {
//       console.error("Error toggling mic:", error);
//       toast.error("Failed to toggle microphone");
//     }
//   };

//   const toggleVideo = async () => {
//     try {
//       if (!videoProducerRef.current) {
//         throw new Error("No video producer available");
//       }

//       const videoProducerId = videoProducerRef.current.id;

//       if (isVideoOn) {
//         videoProducerRef.current.pause();
//         await sendRequest(WebSocketEventType.ADD_PAUSED_PRODUCER, { videoProducerId });
//         setIsVideoOn(false);
//         toast.success("Video muted");
//       } else {
//         videoProducerRef.current.resume();
//         await sendRequest(WebSocketEventType.REMOVE_PAUSED_PRODUCER, { videoProducerId });
//         setIsVideoOn(true);
//         toast.success("Video unmuted");
//       }
//     } catch (error) {
//       console.error("Error toggling video:", error);
//       toast.error("Failed to toggle video");
//     }
//   };

//   const handleEndCall = async () => {
//     try {
//       // Synchronous cleanup
//       localStreamTracksRef.current.forEach((track) => track.stop());
//       localStreamTracksRef.current = [];

//       if (videoProducerRef.current) {
//         socket.emit(WebSocketEventType.CLOSE_PRODUCER, { producer_id: videoProducerRef.current.id });
//         videoProducerRef.current.close();
//         videoProducerRef.current = null;
//       }
//       if (audioProducerRef.current) {
//         socket.emit(WebSocketEventType.CLOSE_PRODUCER, { producer_id: audioProducerRef.current.id });
//         audioProducerRef.current.close();
//         audioProducerRef.current = null;
//       }

//       if (producerTransportRef.current) {
//         producerTransportRef.current.close();
//         producerTransportRef.current = null;
//       }
//       if (consumerTransportRef.current) {
//         consumerTransportRef.current.close();
//         consumerTransportRef.current = null;
//       }

//       consumers.current.forEach((consumer) => consumer.close());
//       consumers.current.clear();
//       consumedProducers.current.clear();
//       setRemoteStreams([]);
//       setProducers([]);
//       setPausedVideoProducerIds([]);
//       setPausedAudioProducerIds([]);

//       if (userId) {
//         socket.emit(WebSocketEventType.EXIT_ROOM, { userId });
//       }

//       socket.offAny();
//       socket.disconnect();

//       if (localStreamRef.current) {
//         localStreamRef.current.srcObject = null;
//       }

//       toast.success("Call ended successfully");
//     } catch (error) {
//       console.error("Error ending call:", error);
//       toast.error("Failed to end call properly");
//     } finally {
//       router.push("/home");
//       setTimeout(() => {
//         if (window.location.pathname !== "/home") {
//           window.location.href = "/home";
//         }
//       }, 500);
//     }
//   };

//   const userJoined = (args: any) => {
//     const user = args.user as Peer;
//     if (user.id === userId) {
//       return;
//     }
//     toast.success(`${user.name} has joined the call`);
//     setUsersInRoom((prev) => {
//       if (prev.some((peer) => peer.id === user.id)) {
//         return prev;
//       }
//       return [...prev, user];
//     });
//     getProducersList();
//   };

//   const userLeft = (args: any) => {
//     const leftUser = args.user as Peer;
//     const producerIds = args.leavingProducers || [];

//     toast.success(`${leftUser.name} left the call`);

//     setUsersInRoom((prev) => prev.filter((peer) => peer.id !== leftUser.id));
//     setRemoteStreams((streams) => streams.filter((stream) => !producerIds.includes(stream.producerId)));
//     setProducers((prev) => prev.filter((p) => !producerIds.includes(p.producer_id)));
//     setPausedVideoProducerIds((prev) => prev.filter((id) => !producerIds.includes(id)));
//     setPausedAudioProducerIds((prev) => prev.filter((id) => !producerIds.includes(id)));
//   };

//   const newProducers = (args: ProducerContainer[] | ProducerContainer) => {
//     const producersArray = Array.isArray(args) ? args : [args];
//     setProducers((prev) => {
//       const currentProducers = Array.isArray(prev) ? prev : [];
//       const newProducers = producersArray.filter(
//         (newProd) => !currentProducers.some((prod) => prod.producer_id === newProd.producer_id)
//       );
//       return [...currentProducers, ...newProducers];
//     });
//   };

//   const closedProducers = (args: { producer_id: string; userId: string }) => {
//     setProducers((prev) => prev.filter((prod) => prod.producer_id !== args.producer_id));
//     setRemoteStreams((prev) => prev.filter((stream) => stream.producerId !== args.producer_id));
//     setPausedVideoProducerIds((prev) => prev.filter((id) => id !== args.producer_id));
//     setPausedAudioProducerIds((prev) => prev.filter((id) => id !== args.producer_id));
//   };

//   const consumerClosed = (args: { consumer_id: string }) => {
//     const consumerId = args.consumer_id;
//     const consumer = Array.from(consumers.current.entries()).find(([_, c]) => c.id === consumerId)?.[1];
//     if (consumer) {
//       consumer.close();
//       consumers.current.delete(consumer.producerId);
//       setRemoteStreams((prev) => prev.filter((stream) => stream.consumer.id !== consumerId));
//     }
//   };

//   const getUserNameByProducerId = (producerId: string): string => {
//     const producer = producers.find((p) => p.producer_id === producerId);
//     const user = usersInRoom.find((u) => u.id === producer?.userId);
//     if (!user) {
//       console.warn(`Could not resolve username for producerId ${producerId}. Producers:`, producers, "Users:", usersInRoom);
//       return "User"; // Fallback to a generic label instead of "Unknown"
//     }
//     return user.name;
//   };

//   if (isTabLocked) {
//     return (
//       <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-800 min-h-screen flex items-center justify-center p-6">
//         <div className="text-white text-center">
//           <h1 className="text-3xl font-semibold mb-4">Call Already Active</h1>
//           <p>This call is already open in another tab. Please use that tab or close it to continue here.</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <Toaster position="bottom-left" richColors />
//       <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-800 min-h-screen relative p-6">
//         <h1 className="text-3xl font-semibold text-center mb-8 text-white tracking-wide">
//           🎥 Video Calling App
//         </h1>

//         {/* Local Stream */}
//         <section className="fixed bottom-6 right-6 z-50">
//           <div className="w-60 rounded-xl overflow-hidden shadow-xl backdrop-blur bg-white/5 border border-white/10 relative">
//             <video
//               autoPlay
//               muted
//               playsInline
//               ref={localStreamRef}
//               className="w-full h-full object-contain"
//             />
//             {!isVideoOn && (
//               <div className="absolute inset-0 flex items-center justify-center">
//                 <div className="w-24 h-24 rounded-full bg-gray-700 text-white flex items-center justify-center text-4xl font-semibold">
//                   {username?.[0]?.toUpperCase() || "?"}
//                 </div>
//               </div>
//             )}

//             {!isMicOn && (
//               <div className="absolute top-2 right-2 text-white">
//                 <MicOff />
//               </div>
//             )}

//             <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 rounded-sm">
//               {username} (You)
//             </div>
//           </div>
//         </section>

//         {/* Remote Streams */}
//         <div
//           className="w-full gap-6 px-2 md:px-6 pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
//           style={{ height: "calc(100vh - 80px)", overflow: "auto" }}
//         >
//           {remoteStreams.filter(({ kind }) => kind === "video").length === 0 && usersInRoom.length === 0 ? (
//             <div className="w-full h-full flex flex-col items-center justify-center text-white text-xl bg-black/50 rounded-xl space-y-4 col-span-full">
//               <div className="flex items-center space-x-1 font-semibold text-2xl">
//                 <span>Waiting for others to join</span>
//                 <span className="animate-bounce [animation-delay:0s]">.</span>
//                 <span className="animate-bounce [animation-delay:0.2s]">.</span>
//                 <span className="animate-bounce [animation-delay:0.4s]">.</span>
//               </div>
//             </div>
//           ) : (
//             remoteStreams
//   .filter(({ kind, userId: streamUserId }) => kind === "video" && streamUserId !== userId) // Exclude sender's stream
//   .map(({ stream, producerId }) => {
//     const userName = getUserNameByProducerId(producerId);
//     const userInitial = userName?.[0]?.toUpperCase() || "?";
//     const user = usersInRoom.find((u) => u.name === userName);
//     const audioProducer = producers.find((p) => p.userId === user?.id && p.kind === "audio");
//     const isMicOff = audioProducer ? pausedAudioProducerIds.includes(audioProducer.producer_id) : false;
//     return (
//       <div
//         key={producerId}
//         className="relative rounded-xl overflow-hidden bg-white/5 backdrop-blur shadow-lg border border-white/10"
//       >
//         {!pausedVideoProducerIds.includes(producerId) ? (
//           <video
//             autoPlay
//             playsInline
//             muted
//             className="w-full h-full object-contain aspect-video"
//             ref={(videoElement) => {
//               if (videoElement && videoElement.srcObject !== stream) {
//                 videoElement.srcObject = stream;
//                 videoElement.play().catch((e) => console.error("Video play error:", e));
//               }
//             }}
//           />
//         ) : (
//           <div className="w-full h-full aspect-video flex flex-col items-center justify-center bg-black text-white">
//             <div className="w-24 h-24 flex items-center justify-center rounded-full bg-gray-700 mb-2 text-4xl font-semibold">
//               {userInitial}
//             </div>
//           </div>
//         )}

//         {isMicOff && (
//           <div className="absolute top-2 right-2 text-white">
//             <MicOff />
//           </div>
//         )}

//         <div className="absolute bottom-2 left-2 md:text-lg bg-black/60 text-white text-sm px-2 py-1 rounded-md">
//           {userName}
//         </div>
//       </div>
//     );
//   })
//           )}
//         </div>

//         {/* Control Buttons */}
//         <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-4 bg-black/70 p-4 rounded-full shadow-lg backdrop-blur-md border border-white/10">
//           <button
//             onClick={toggleMic}
//             className={`transition-all duration-300 ease-in-out hover:-translate-y-1 p-3 rounded-full ${
//               isMicOn ? "bg-white text-black hover:bg-gray-200" : "bg-gray-800 text-white hover:bg-gray-700"
//             }`}
//             title="Toggle Mic"
//           >
//             {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
//           </button>

//           <button
//             onClick={handleEndCall}
//             className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all duration-300 hover:-translate-y-1 ease-in-out"
//             title="End Call"
//           >
//             <Phone size={20} />
//           </button>

//           <button
//             onClick={toggleVideo}
//             className={`transition-all duration-300 ease-in-out p-3 hover:-translate-y-1 rounded-full ${
//               isVideoOn ? "bg-white text-black hover:bg-gray-200" : "bg-gray-800 text-white hover:bg-gray-700"
//             }`}
//             title="Toggle Video"
//           >
//             {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
//           </button>
//         </div>

//         {/* Audio Streams (Hidden) */}
//         <section>
//           {remoteStreams
//             .filter(({ kind }) => kind === "audio")
//             .map(({ stream, producerId }) => (
//               <div key={producerId} className="hidden">
//                 <audio
//                   autoPlay
//                   ref={(audioElement) => {
//                     if (audioElement && audioElement.srcObject !== stream) {
//                       audioElement.srcObject = stream;
//                       audioElement.play().catch((e) => console.error("Audio play error:", e));
//                     }
//                   }}
//                 />
//               </div>
//             ))}
//         </section>
//       </div>
//     </>
//   );
// }




'use client'

import { io } from "socket.io-client";
import { Device } from 'mediasoup-client';
import { useParams, useRouter } from "next/navigation";
import { useMemo, useEffect, useState, useRef } from "react";
import { Toaster, toast } from "sonner";
import useAuth from "@/hooks/useAuth";
import { WebSocketEventType } from "@/lib/types";
import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  Producer,
  Transport,
  Consumer,
  RtpCapabilities,
} from "mediasoup-client/lib/types";
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

// Types and interfaces
interface WebRtcTransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

interface ProducerContainer {
  producer_id: string;
  userId: string;
  kind: MediaKind;
}

interface Peer {
  id: string;
  name: string;
}

interface RemoteStream {
  consumer: Consumer;
  stream: MediaStream;
  kind: MediaKind;
  producerId: string;
  userId: string;
}

export default function Page() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const localStreamRef = useRef<HTMLVideoElement | null>(null);
  const localStreamTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioProducerRef = useRef<Producer | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const consumerTransportRef = useRef<Transport | null>(null);
  const producerTransportRef = useRef<Transport | null>(null);
  const consumers = useRef<Map<string, Consumer>>(new Map());
  const consumedProducers = useRef<Set<string>>(new Set());
  const callActiveRef = useRef<boolean>(false);

  const [userId, setUserId] = useState<string | undefined>();
  const [username, setUsername] = useState<string | undefined>();
  const [isTabLocked, setIsTabLocked] = useState<boolean>(false);
  const [producers, setProducers] = useState<ProducerContainer[]>([]);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(true);
  const [usersInRoom, setUsersInRoom] = useState<Peer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [pausedVideoProducerIds, setPausedVideoProducerIds] = useState<string[]>([]);
  const [pausedAudioProducerIds, setPausedAudioProducerIds] = useState<string[]>([]);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(false);

  const socket = useMemo(() =>
    io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`, {
      withCredentials: true,
    }), []
  );

  useEffect(() => {
    if (isAuthenticated === false && !isLoading) {
      toast.error("You are not logged in");
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedName = localStorage.getItem("username");
    if (!storedUserId || !storedName) {
      toast.error("User not found. Redirecting to login.");
      router.replace("/login");
      return;
    }
    setUserId(storedUserId);
    setUsername(storedName);
  }, [router]);

  useEffect(() => {
    const lockKey = `call_lock_${roomId}`;
    const acquireLock = () => {
      const existingLock = localStorage.getItem(lockKey);
      if (existingLock) {
        setIsTabLocked(true);
        toast.error("This call is already open in another tab. Please use that tab or close it to continue here.");
        return false;
      }
      localStorage.setItem(lockKey, "locked");
      window.addEventListener("unload", releaseLock);
      return true;
    };

    const releaseLock = () => {
      localStorage.removeItem(lockKey);
    };

    if (!acquireLock()) {
      return;
    }

    return () => {
      releaseLock();
      window.removeEventListener("unload", releaseLock);
    };
  }, [roomId]);

  useEffect(() => {
    if (!isAuthenticated || isLoading || !userId || !username || isTabLocked || callActiveRef.current) {
      return;
    }

    const init = async () => {
      callActiveRef.current = true;
      try {
        await loadEverything();
        await startStreaming();
      } catch (error) {
        console.error("Initialization failed:", error);
        toast.error("Failed to start call. Redirecting to home.");
        router.push("/home");
      }
    };

    init();

    const routeIncomingEvents = ({ event, args }: { event: WebSocketEventType; args: any }) => {
      switch (event) {
        case WebSocketEventType.USER_JOINED:
          userJoined(args);
          break;
        case WebSocketEventType.USER_LEFT:
          userLeft(args);
          break;
        case WebSocketEventType.NEW_PRODUCERS:
          newProducers(args);
          break;
        case WebSocketEventType.PRODUCER_CLOSED:
          closedProducers(args);
          break;
        case WebSocketEventType.CONSUMER_CLOSED:
          consumerClosed(args);
          break;
        default:
          break;
      }
    };

    socket.onAny(routeIncomingEvents);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      localStreamTracksRef.current.forEach((track) => track.stop());
      if (videoProducerRef.current) {
        sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: videoProducerRef.current.id }).catch((err) =>
          console.error("Error closing video producer on unload:", err)
        );
        videoProducerRef.current.close();
      }
      if (audioProducerRef.current) {
        sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: audioProducerRef.current.id }).catch((err) =>
          console.error("Error closing audio producer on unload:", err)
        );
        audioProducerRef.current.close();
      }
      if (userId) {
        sendRequest(WebSocketEventType.EXIT_ROOM, { userId }).catch((err) =>
          console.error("Error exiting room on unload:", err)
        );
      }
      socket.disconnect();
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.offAny(routeIncomingEvents);
      handleEndCall();
      callActiveRef.current = false;
    };
  }, [isAuthenticated, isLoading, userId, username, isTabLocked, socket, router, roomId]);

  useEffect(() => {
    const getPausedProducers = (pausedProducers: string[]) => {
      setPausedVideoProducerIds(pausedProducers || []);
    };

    socket.on(WebSocketEventType.GET_PAUSED_PRODUCERS, getPausedProducers);

    return () => {
      socket.off(WebSocketEventType.GET_PAUSED_PRODUCERS, getPausedProducers);
    };
  }, [socket]);

  useEffect(() => {
    const getPausedAudioProducers = (pausedProducers: string[]) => {
      setPausedAudioProducerIds(pausedProducers || []);
    };

    socket.on(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, getPausedAudioProducers);

    return () => {
      socket.off(WebSocketEventType.GET_PAUSED_AUDIO_PRODUCERS, getPausedAudioProducers);
    };
  }, [socket]);

  useEffect(() => {
    const handleConsumerCleanup = (producerId: string) => {
      setRemoteStreams((prev) => prev.filter((stream) => stream.producerId !== producerId));
      consumedProducers.current.delete(producerId);
    };

    socket.on(WebSocketEventType.PRODUCER_CLOSED, ({ producer_id }: { producer_id: string }) => {
      handleConsumerCleanup(producer_id);
    });

    return () => {
      socket.off(WebSocketEventType.PRODUCER_CLOSED, handleConsumerCleanup);
    };
  }, [socket]);

  useEffect(() => {
    if (producers.length === 0 || !consumerTransportRef.current || !deviceRef.current) {
      return;
    }

    const consumeNewProducers = async () => {
      const unconsumedProducers = producers.filter(
        (producer) =>
          !consumedProducers.current.has(producer.producer_id) &&
          producer.userId !== userId
      );
      if (unconsumedProducers.length === 0) {
        console.log("No new producers to consume");
        return;
      }
      console.log("Consuming new producers:", unconsumedProducers);
      for (const producer of unconsumedProducers) {
        try {
          await consume(producer);
          consumedProducers.current.add(producer.producer_id);
        } catch (error) {
          console.error(`Failed to consume producer ${producer.producer_id}:`, error);
        }
      }
    };

    consumeNewProducers().catch((error) => {
      console.error("Error in consumeNewProducers:", error);
    });
  }, [producers, userId]);

  const sendRequest = (eventType: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      socket.emit(eventType, data, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  };

  const joinRoom = async () => {
    try {
      const response = await sendRequest(WebSocketEventType.JOIN_ROOM, {
        userId,
        roomId,
        name: username,
      });
      setUsersInRoom(response.users || []);
      setPausedVideoProducerIds(response.pausedVideoProducerIds || []);
      setPausedAudioProducerIds(response.pausedAudioProducerIds || []);
      return response;
    } catch (error) {
      console.error("Error joining room:", error);
      throw error;
    }
  };

  const getRtpCapabilities = async (retries = 3, delay = 1000): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await sendRequest(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, {});
        if (!response?.rtpCapabilities) {
          throw new Error("Invalid or missing routerRtpCapabilities from server");
        }

        const device = new Device();
        deviceRef.current = device;
        await device.load({ routerRtpCapabilities: response.rtpCapabilities });
        return response;
      } catch (error) {
        console.error(`getRtpCapabilities attempt ${attempt} failed:`, error);
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Failed to get RTP capabilities after all retries");
  };

  const getCurrentUsers = async () => {
    try {
      const response = await sendRequest(WebSocketEventType.GET_IN_ROOM_USERS, {});
      setUsersInRoom(response.users || []);
      return response;
    } catch (error) {
      console.error("Error getting current users:", error);
      throw error;
    }
  };

  const createProducerTransport = async () => {
    if (!deviceRef.current) {
      throw new Error("Device not initialized");
    }

    try {
      const response = await sendRequest(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, {
        userId,
      }) as { params: WebRtcTransportParams };

      producerTransportRef.current = deviceRef.current.createSendTransport(response.params);

      producerTransportRef.current.on("connect", async ({ dtlsParameters }, cb, eb) => {
        try {
          await sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
            userId,
            transportId: producerTransportRef.current!.id,
            dtlsParameters,
          });
          cb();
        } catch (error) {
          console.error("Error connecting producer transport:", error);
          eb(error as Error);
        }
      });

      producerTransportRef.current.on("produce", async ({ kind, rtpParameters }, cb, eb) => {
        try {
          const { producer_id } = await sendRequest(WebSocketEventType.PRODUCE, {
            userId,
            producerTransportId: producerTransportRef.current!.id,
            kind,
            rtpParameters,
          }) as { producer_id: string };
          cb({ id: producer_id });
        } catch (error) {
          console.error("Error in produce:", error);
          eb(error as Error);
        }
      });

      producerTransportRef.current.on("connectionstatechange", (state) => {
        if (state === "disconnected") {
          producerTransportRef.current?.close();
        }
      });

      return true;
    } catch (error) {
      console.error("Error creating producer transport:", error);
      throw error;
    }
  };

  const createConsumerTransport = async () => {
    try {
      if (consumerTransportRef.current) {
        return;
      }

      const data = await sendRequest(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, {
        userId,
      }) as { params: WebRtcTransportParams };

      if (!deviceRef.current) {
        throw new Error("Device not initialized");
      }

      consumerTransportRef.current = deviceRef.current.createRecvTransport(data.params);

      consumerTransportRef.current.on("connect", async ({ dtlsParameters }, cb, eb) => {
        try {
          await sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
            userId,
            transportId: consumerTransportRef.current?.id,
            dtlsParameters,
          });
          cb();
        } catch (error) {
          console.error("Error connecting consumer transport:", error);
          eb(error as Error);
        }
      });

      consumerTransportRef.current.on("connectionstatechange", (state) => {
        if (state === "disconnected") {
          consumerTransportRef.current?.close();
        }
      });
    } catch (error) {
      console.error("Error creating consumer transport:", error);
      throw error;
    }
  };

  const getProducersList = async () => {
    try {
      const { producerList } = await sendRequest(WebSocketEventType.GET_PRODUCERS, {});
      if (producerList?.length > 0) {
        setProducers(producerList);
      } else {
        setProducers([]);
      }
      await getCurrentUsers(); // Ensure users are updated after fetching producers
    } catch (error) {
      console.error("Error getting producers:", error);
    }
  };

  const consume = async (producer: ProducerContainer) => {
    try {
      const data = await consumeProducers(producer.producer_id, producer.kind);
      if (!data) {
        return;
      }

      const { consumer, stream, kind, producerId } = data;
      if (!userId) {
        return;
      }

      consumers.current.set(producerId, consumer);

      setRemoteStreams((prev) => {
        const existingStream = prev.find((s) => s.producerId === producerId && s.kind === kind);
        if (existingStream) {
          return prev;
        }
        return [...prev, { consumer, stream, kind, producerId, userId: producer.userId }];
      });

      if (kind === "audio") {
        const audioElements = document.querySelectorAll("audio");
        audioElements.forEach((audio: HTMLAudioElement) => {
          audio.play().catch((e) => {
            if (e.name === "NotAllowedError") {
              setNeedsUserInteraction(true);
            }
          });
        });
      }
    } catch (error) {
      console.error("Error consuming producer:", producer.producer_id, error);
    }
  };

  const consumeProducers = async (producerId: string, kind: MediaKind): Promise<RemoteStream | null> => {
    if (!deviceRef.current || !consumerTransportRef.current) {
      return null;
    }

    try {
      const rtpCapabilities = deviceRef.current.rtpCapabilities;
      const data = await sendRequest(WebSocketEventType.CONSUME, {
        userId,
        rtpCapabilities,
        consumerTransportId: consumerTransportRef.current.id,
        producerId,
      });

      const { id, rtpParameters } = data;

      const consumer = await consumerTransportRef.current.consume({
        id,
        producerId,
        kind,
        rtpParameters,
      });

      const stream = new MediaStream();
      stream.addTrack(consumer.track);

      return {
        consumer,
        stream,
        kind,
        producerId,
        userId: userId!,
      };
    } catch (error) {
      console.error("Error consuming producer:", producerId, error);
      return null;
    }
  };

  const loadEverything = async () => {
    try {
      await joinRoom();
      await getRtpCapabilities();
      await Promise.all([getCurrentUsers(), createConsumerTransport(), createProducerTransport(), getProducersList()]);
    } catch (error) {
      console.error("Error loading everything:", error);
      throw error;
    }
  };

  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      localStreamTracksRef.current = [videoTrack, audioTrack];

      if (localStreamRef.current) {
        localStreamRef.current.srcObject = stream;
        localStreamRef.current.play().catch((e) => {
          if (e.name === "NotAllowedError") {
            setNeedsUserInteraction(true);
          }
        });
      }

      if (!producerTransportRef.current) {
        throw new Error("Producer transport not initialized");
      }

      const videoProducer = await producerTransportRef.current.produce({ track: videoTrack });
      const audioProducer = await producerTransportRef.current.produce({ track: audioTrack });

      videoProducerRef.current = videoProducer;
      audioProducerRef.current = audioProducer;

      if (!isVideoOn && videoProducer) {
        videoProducer.pause();
        await sendRequest(WebSocketEventType.ADD_PAUSED_PRODUCER, { videoProducerId: videoProducer.id });
      }

      if (!isMicOn && audioProducer) {
        audioProducer.pause();
        await sendRequest(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, { audioProducerId: audioProducer.id });
      }

      await getProducersList();
    } catch (error) {
      console.error("Error starting streaming:", error);
      toast.error("Failed to start streaming");
      throw error;
    }
  };

  const toggleMic = async () => {
    try {
      if (!audioProducerRef.current) {
        throw new Error("No audio producer available");
      }

      const audioProducerId = audioProducerRef.current.id;

      if (isMicOn) {
        audioProducerRef.current.pause();
        await sendRequest(WebSocketEventType.ADD_PAUSED_AUDIO_PRODUCER, { audioProducerId });
        setIsMicOn(false);
        toast.success("Microphone muted");
      } else {
        audioProducerRef.current.resume();
        await sendRequest(WebSocketEventType.REMOVE_PAUSED_AUDIO_PRODUCER, { audioProducerId });
        setIsMicOn(true);
        toast.success("Microphone unmuted");
      }
    } catch (error) {
      console.error("Error toggling mic:", error);
      toast.error("Failed to toggle microphone");
    }
  };

  const toggleVideo = async () => {
    try {
      if (!videoProducerRef.current) {
        throw new Error("No video producer available");
      }

      const videoProducerId = videoProducerRef.current.id;

      if (isVideoOn) {
        videoProducerRef.current.pause();
        await sendRequest(WebSocketEventType.ADD_PAUSED_PRODUCER, { videoProducerId });
        setIsVideoOn(false);
        toast.success("Video muted");
      } else {
        videoProducerRef.current.resume();
        await sendRequest(WebSocketEventType.REMOVE_PAUSED_PRODUCER, { videoProducerId });
        setIsVideoOn(true);
        toast.success("Video unmuted");
      }
    } catch (error) {
      console.error("Error toggling video:", error);
      toast.error("Failed to toggle video");
    }
  };

  const handleEndCall = async () => {
    try {
      localStreamTracksRef.current.forEach((track) => track.stop());
      localStreamTracksRef.current = [];

      if (videoProducerRef.current) {
        videoProducerRef.current.close();
        await sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: videoProducerRef.current.id });
        videoProducerRef.current = null;
      }
      if (audioProducerRef.current) {
        audioProducerRef.current.close();
        await sendRequest(WebSocketEventType.CLOSE_PRODUCER, { producer_id: audioProducerRef.current.id });
        audioProducerRef.current = null;
      }

      if (producerTransportRef.current) {
        producerTransportRef.current.close();
        producerTransportRef.current = null;
      }
      if (consumerTransportRef.current) {
        consumerTransportRef.current.close();
        consumerTransportRef.current = null;
      }

      consumers.current.forEach((consumer) => consumer.close());
      consumers.current.clear();
      consumedProducers.current.clear();
      setRemoteStreams([]);
      setProducers([]);
      setPausedVideoProducerIds([]);
      setPausedAudioProducerIds([]);

      if (userId) {
        await sendRequest(WebSocketEventType.EXIT_ROOM, { userId });
      }

      socket.offAny();
      socket.disconnect();

      if (localStreamRef.current) {
        localStreamRef.current.srcObject = null;
      }

      toast.success("Call ended successfully");
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call properly");
    } finally {
      router.push("/home");
      setTimeout(() => {
        if (window.location.pathname !== "/home") {
          window.location.href = "/home";
        }
      }, 500);
    }
  };

  const userJoined = async (args: any) => {
    const user = args.user as Peer;
    if (user.id === userId) {
      return;
    }
    toast.success(`${user.name} has joined the call`);
    setUsersInRoom((prev) => {
      if (prev.some((peer) => peer.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
    await getProducersList(); // Fetch updated producers
    await getCurrentUsers(); // Ensure users list is up-to-date
  };

  const userLeft = async (args: any) => {
    const leftUser = args.user as Peer;
    const producerIds = args.leavingProducers || [];

    toast.success(`${leftUser.name} left the call`);

    setUsersInRoom((prev) => prev.filter((peer) => peer.id !== leftUser.id));
    setRemoteStreams((streams) => streams.filter((stream) => !producerIds.includes(stream.producerId)));
    setProducers((prev) => prev.filter((p) => !producerIds.includes(p.producer_id)));
    setPausedVideoProducerIds((prev) => prev.filter((id) => !producerIds.includes(id)));
    setPausedAudioProducerIds((prev) => prev.filter((id) => !producerIds.includes(id)));
    producerIds.forEach((producerId: string) => consumedProducers.current.delete(producerId));
    await getProducersList(); // Fetch updated producers after user leaves
    await getCurrentUsers(); // Ensure users list is up-to-date
  };

  const newProducers = async (args: ProducerContainer[] | ProducerContainer) => {
    const producersArray = Array.isArray(args) ? args : [args];
    setProducers((prev) => {
      const currentProducers = Array.isArray(prev) ? prev : [];
      const newProducers = producersArray.filter(
        (newProd) => !currentProducers.some((prod) => prod.producer_id === newProd.producer_id)
      );
      return [...currentProducers, ...newProducers];
    });
    await getCurrentUsers(); // Ensure users list is up-to-date
    await getProducersList(); // Force re-fetch to ensure all producers are captured
  };

  const closedProducers = async (args: { producer_id: string; userId: string }) => {
    setProducers((prev) => prev.filter((prod) => prod.producer_id !== args.producer_id));
    setRemoteStreams((prev) => prev.filter((stream) => stream.producerId !== args.producer_id));
    setPausedVideoProducerIds((prev) => prev.filter((id) => id !== args.producer_id));
    setPausedAudioProducerIds((prev) => prev.filter((id) => id !== args.producer_id));
    consumedProducers.current.delete(args.producer_id);
    await getProducersList(); // Fetch updated producers
    await getCurrentUsers(); // Ensure users list is up-to-date
  };

  const consumerClosed = (args: { consumer_id: string }) => {
    const consumerId = args.consumer_id;
    const consumer = Array.from(consumers.current.entries()).find(([_, c]) => c.id === consumerId)?.[1];
    if (consumer) {
      consumer.close();
      consumers.current.delete(consumer.producerId);
      setRemoteStreams((prev) => prev.filter((stream) => stream.consumer.id !== consumerId));
    }
  };

  const getUserNameByProducerId = (producerId: string): string => {
    const producer = producers.find((p) => p.producer_id === producerId);
    const user = usersInRoom.find((u) => u.id === producer?.userId);
    if (!user) {
      console.warn(`Could not resolve username for producerId ${producerId}. Producers:`, producers, "Users:", usersInRoom);
      return "User";
    }
    return user.name;
  };

  const handleUserInteraction = () => {
    setNeedsUserInteraction(false);
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio: HTMLAudioElement) => {
      audio.play().catch((e) => console.error("Audio play error after interaction:", e));
    });
    const videoElements = document.querySelectorAll("video");
    videoElements.forEach((video: HTMLVideoElement) => {
      video.play().catch((e) => console.error("Video play error after interaction:", e));
    });
  };

  if (isTabLocked) {
    return (
      <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-800 min-h-screen flex items-center justify-center p-6">
        <div className="text-white text-center">
          <h1 className="text-3xl font-semibold mb-4">Call Already Active</h1>
          <p>This call is already open in another tab. Please use that tab or close it to continue here.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="bottom-left" richColors />
      <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-800 min-h-screen relative p-6">
        {needsUserInteraction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <button
              onClick={handleUserInteraction}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-semibold"
            >
              Click to Start Call
            </button>
          </div>
        )}
        <h1 className="text-3xl font-semibold text-center mb-8 text-white tracking-wide">
          🎥 Video Calling App
        </h1>

        {/* Local Stream */}
        <section className="fixed bottom-6 right-6 z-50">
          <div className="w-60 rounded-xl overflow-hidden shadow-xl backdrop-blur bg-white/5 border border-white/10 relative">
            <video
              autoPlay
              muted
              playsInline
              ref={localStreamRef}
              className="w-full h-full object-contain"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gray-700 text-white flex items-center justify-center text-4xl font-semibold">
                  {username?.[0]?.toUpperCase() || "?"}
                </div>
              </div>
            )}

            {!isMicOn && (
              <div className="absolute top-2 right-2 text-white">
                <MicOff />
              </div>
            )}

            <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 rounded-sm">
              {username} (You)
            </div>
          </div>
        </section>

        {/* Remote Streams */}
        <div
          className="w-full gap-4 px-2 md:px-6 pb-20 grid auto-rows-fr"
          style={{
            height: "calc(100vh - 80px)",
            overflow: "auto",
            gridTemplateColumns: remoteStreams.filter(({ kind, userId: streamUserId }) => kind === "video" && streamUserId !== userId).length === 1
              ? "1fr"
              : remoteStreams.filter(({ kind, userId: streamUserId }) => kind === "video" && streamUserId !== userId).length === 2
              ? "repeat(2, 1fr)"
              : "repeat(auto-fit, minmax(300px, 1fr))",
          }}
        >
          {remoteStreams.filter(({ kind }) => kind === "video").length === 0 && usersInRoom.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-white text-xl bg-black/50 rounded-xl space-y-4 col-span-full">
              <div className="flex items-center space-x-1 font-semibold text-2xl">
                <span>Waiting for others to join</span>
                <span className="animate-bounce [animation-delay:0s]">.</span>
                <span className="animate-bounce [animation-delay:0.2s]">.</span>
                <span className="animate-bounce [animation-delay:0.4s]">.</span>
              </div>
            </div>
          ) : (
            remoteStreams
              .filter(({ kind, userId: streamUserId }) => kind === "video" && streamUserId !== userId)
              .map(({ stream, producerId }) => {
                const userName = getUserNameByProducerId(producerId);
                const userInitial = userName?.[0]?.toUpperCase() || "?";
                const user = usersInRoom.find((u) => u.name === userName);
                const audioProducer = producers.find((p) => p.userId === user?.id && p.kind === "audio");
                const isMicOff = audioProducer ? pausedAudioProducerIds.includes(audioProducer.producer_id) : false;
                return (
                  <div
                    key={producerId}
                    className="relative rounded-xl overflow-hidden bg-white/5 backdrop-blur shadow-lg border border-white/10"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {!pausedVideoProducerIds.includes(producerId) ? (
                      <video
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain"
                        ref={(videoElement) => {
                          if (videoElement && videoElement.srcObject !== stream) {
                            videoElement.srcObject = stream;
                            videoElement.play().catch((e) => {
                              if (e.name === "NotAllowedError") {
                                setNeedsUserInteraction(true);
                              }
                            });
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white">
                        <div className="w-24 h-24 flex items-center justify-center rounded-full bg-gray-700 mb-2 text-4xl font-semibold">
                          {userInitial}
                        </div>
                      </div>
                    )}

                    {isMicOff && (
                      <div className="absolute top-2 right-2 text-white">
                        <MicOff />
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 md:text-lg bg-black/60 text-white text-sm px-2 py-1 rounded-md">
                      {userName}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Control Buttons */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-4 bg-black/70 p-4 rounded-full shadow-lg backdrop-blur-md border border-white/10">
          <button
            onClick={toggleMic}
            className={`transition-all duration-300 ease-in-out hover:-translate-y-1 p-3 rounded-full ${
              isMicOn ? "bg-white text-black hover:bg-gray-200" : "bg-gray-800 text-white hover:bg-gray-700"
            }`}
            title="Toggle Mic"
          >
            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={handleEndCall}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all duration-300 hover:-translate-y-1 ease-in-out"
            title="End Call"
          >
            <Phone size={20} />
          </button>

          <button
            onClick={toggleVideo}
            className={`transition-all duration-300 ease-in-out p-3 hover:-translate-y-1 rounded-full ${
              isVideoOn ? "bg-white text-black hover:bg-gray-200" : "bg-gray-800 text-white hover:bg-gray-700"
            }`}
            title="Toggle Video"
          >
            {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>

        {/* Audio Streams (Hidden) */}
        <section>
          {remoteStreams
            .filter(({ kind }) => kind === "audio")
            .map(({ stream, producerId }) => (
              <div key={producerId} className="hidden">
                <audio
                  autoPlay
                  ref={(audioElement) => {
                    if (audioElement && audioElement.srcObject !== stream) {
                      audioElement.srcObject = stream;
                      audioElement.play().catch((e) => {
                        if (e.name === "NotAllowedError") {
                          setNeedsUserInteraction(true);
                        }
                      });
                    }
                  }}
                />
              </div>
            ))}
        </section>
      </div>
    </>
  );
}