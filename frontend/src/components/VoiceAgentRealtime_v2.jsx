/**
 * Real-Time Streaming Voice Agent Component
 * ==========================================
 * 
 * This component implements a fully real-time voice assistant that:
 * - Captures microphone audio and streams to backend via WebSocket
 * - Displays live transcription (partial and final)
 * - Shows AI responses with typing animation
 * - Plays AI-generated speech audio in real-time
 * - Tracks extracted structured data (name, income, credit score, loan amount)
 * - Displays loan eligibility results
 * 
 * Tech Stack:
 * - MediaRecorder API for audio capture (sending PCM16LE)
 * - WebSocket for bi-directional streaming
 * - Web Audio API for playing TTS audio chunks
 * - React hooks for state management
 * 
 * @author AI Development Assistant
 * @date November 2025
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Volume2, VolumeX, X } from 'lucide-react';
import FileUpload from './FileUpload';
import LoanResultCard from './LoanResultCard';
import { toast } from 'react-toastify';

const VoiceAgentRealtime = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(null);

  // Conversation state
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState([]);
  const [currentAiToken, setCurrentAiToken] = useState('');

  // Structured data extracted by AI
  const [extractedData, setExtractedData] = useState({});
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [applicationId, setApplicationId] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Volume state for visualizer
  const [volume, setVolume] = useState(0);

  // Event Log for debugging
  const [eventLog, setEventLog] = useState([]);
  const addLog = (msg) => setEventLog(prev => [`${new Date().toLocaleTimeString().split(' ')[0]} ${msg}`, ...prev].slice(0, 3));

  // Refs for persistent connections
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isRecordingRef = useRef(false); // Ref for event handlers
  const currentSourceRef = useRef(null); // Track current audio source
  const currentAiTokenRef = useRef('');
  const messagesEndRef = useRef(null);
  const modalScrollRef = useRef(null);

  /**
   * Play next audio chunk from queue
   */
  const playNextAudioChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const base64Audio = audioQueueRef.current.shift();

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        // Use setTimeout to avoid recursion issues
        setTimeout(() => playNextAudioChunk(), 0);
      };

      source.start(0);
      currentSourceRef.current = source;
    } catch (err) {
      console.error('Failed to play audio chunk:', err);
      setTimeout(() => playNextAudioChunk(), 0); // Continue with next chunk
    }
  }, []);

  /**
   * Queue and play audio chunks sequentially
   */
  const queueAudioChunk = useCallback((base64Audio) => {
    audioQueueRef.current.push(base64Audio);
    if (!isPlayingRef.current) {
      playNextAudioChunk();
    }
  }, [playNextAudioChunk]);

  /**
   * Stop current audio playback and clear queue
   */
  const stopAudioPlayback = useCallback(() => {
    // Clear queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // Stop currently playing audio
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }
  }, []);

  /**
   * Auto-scroll to bottom of conversation
   */
  useEffect(() => {
    if (finalTranscripts.length > 0 || partialTranscript || currentAiToken) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [finalTranscripts, currentAiToken, partialTranscript]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = useCallback((message) => {
    const { type, data } = message;

    switch (type) {
      case 'partial_transcript':
        // User started speaking -> Stop AI audio immediately
        stopAudioPlayback();

        // If AI was speaking, finalize its message now (user interrupted or AI finished)
        if (currentAiTokenRef.current) {
          setFinalTranscripts(prev => [...prev, { role: 'assistant', text: currentAiTokenRef.current.split('|||JSON|||')[0] }]);
          currentAiTokenRef.current = '';
          setCurrentAiToken('');
        }
        setPartialTranscript(data);
        break;

      case 'final_transcript':
        // User finished speaking -> Stop AI audio immediately (just in case)
        stopAudioPlayback();

        // If AI was speaking, finalize its message now
        if (currentAiTokenRef.current) {
          setFinalTranscripts(prev => [...prev, { role: 'assistant', text: currentAiTokenRef.current.split('|||JSON|||')[0] }]);
          currentAiTokenRef.current = '';
          setCurrentAiToken('');
        }
        setFinalTranscripts(prev => [...prev, { role: 'user', text: data }]);
        setPartialTranscript('');
        break;

      case 'assistant_transcript':
        // Explicit message from AI (not streamed)
        setFinalTranscripts(prev => [...prev, { role: 'assistant', text: data }]);
        break;

      case 'ai_token':
        currentAiTokenRef.current += data;
        // Filter out the hidden JSON data from the UI
        setCurrentAiToken(currentAiTokenRef.current.split('|||JSON|||')[0]);
        break;

      case 'audio_chunk':
        queueAudioChunk(data);
        // Do NOT clear text here. Let it accumulate until user speaks.
        break;

      case 'structured_update':
        setExtractedData(prev => ({ ...prev, ...data }));
        break;

      case 'eligibility_result':
        setEligibilityResult(data);
        break;

      case 'document_verification_required':
        // Show document upload button
        setShowDocumentUpload(true);
        setExtractedData(data.structured_data);
        // Add AI message about document verification
        if (data.message) {
          setFinalTranscripts(prev => [...prev, { role: 'assistant', text: data.message }]);
        }
        break;

      case 'error':
        setError(data);
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }, [queueAudioChunk, stopAudioPlayback]);

  /**
   * Initialize WebSocket connection to backend
   */
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/voice/stream`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error. Please check backend is running.');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000); // Auto-reconnect after 3 seconds
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to voice agent');
    }
  }, [handleWebSocketMessage]);

  /**
   * Start recording microphone audio using AudioContext for PCM16LE
   */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create AudioContext for raw PCM audio processing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);

      // Create ScriptProcessor for real-time audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Get float32 audio data
          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate volume for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setVolume(Math.min(100, rms * 400)); // Scale up for visibility

          // Convert float32 (-1 to 1) to int16 PCM
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Clamp and convert to 16-bit integer
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send raw PCM16LE audio to backend
          wsRef.current.send(int16Data.buffer);

          // DEBUG: Log first send
          if (!window.hasLoggedAudio) {
            console.log("Sending audio data...");
            window.hasLoggedAudio = true;
          }
        }
      };

      // Connect audio pipeline
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store references for cleanup
      mediaRecorderRef.current = { stream, audioContext, processor, source };
      setIsRecording(true);
      isRecordingRef.current = true;
      setError(null);
      addLog('🎤 Recording Started');

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  /**
   * Stop recording microphone audio
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      const { stream, audioContext, processor, source } = mediaRecorderRef.current;

      // Disconnect audio pipeline
      if (source && processor) {
        try {
          source.disconnect();
          processor.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }

      // Close audio context
      if (audioContext) {
        audioContext.close();
      }

      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;
    setVolume(0);
    addLog('⏹️ Recording Stopped');
  }, []);

  /**
   * Toggle mute/unmute
   */
  const toggleMute = () => {
    if (audioContextRef.current) {
      if (isMuted) {
        audioContextRef.current.resume();
      } else {
        audioContextRef.current.suspend();
      }
      setIsMuted(!isMuted);
    }
  };

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopRecording();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  /**
   * Handle start/stop call button
   */
  const handleCallToggle = () => {
    if (isRecording) {
      stopRecording();
    } else if (isConnected) {
      startRecording();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden relative">

      {/* Header - Minimal */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm p-4 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🎙️ LoanVoice</h1>
          <p className="text-xs text-gray-500">AI Loan Assistant</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Main Content Area - Conversation History */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-4 scroll-smooth">

        {/* Welcome Message */}
        {finalTranscripts.length === 0 && !partialTranscript && !currentAiToken && (
          <div className="text-center text-gray-500 mt-10">
            <p className="mb-2">👋 Hi! I'm your AI Loan Assistant.</p>
          </div>
        )}

        {/* Chat Messages */}
        {finalTranscripts.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-sm ${msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
              }`}>
              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Typing Animation */}
        {currentAiToken && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-bl-none bg-white text-gray-800 border border-gray-100 shadow-sm">
              <p className="whitespace-pre-wrap text-sm">{currentAiToken}</p>
            </div>
          </div>
        )}

        {/* Partial Transcript */}
        {partialTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-br-none bg-blue-400/20 text-blue-900 italic border border-blue-200">
              <p className="text-sm">{partialTranscript}...</p>
            </div>
          </div>
        )}
        {/* Result Card (Inline) */}
        {eligibilityResult && (
          <div className="mt-4 mb-4 w-full">
            <LoanResultCard
              result={{
                eligibility_status: eligibilityResult.eligible ? "eligible" : "ineligible",
                eligibility_score: eligibilityResult.score || 0,
                risk_level: eligibilityResult.score > 0.7 ? "low_risk" : "medium_risk",
                credit_tier: "Good",
                confidence: 0.9
              }}
              applicationId={eligibilityResult.application_id}
              extractedData={extractedData}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Controls Area (Fixed) */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6 z-20">
        <div className="max-w-3xl mx-auto flex items-center gap-3">

          {/* Text Input Bar */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={isRecording ? "Listening..." : "Type a message..."}
              className={`w-full pl-4 pr-10 py-3 rounded-full border-none focus:ring-2 transition-all shadow-sm text-base text-gray-900 ${isRecording
                ? 'bg-red-50 ring-2 ring-red-100 placeholder-red-400'
                : 'bg-gray-100 focus:bg-white focus:ring-blue-500'
                }`}
              value={isRecording ? partialTranscript : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  const text = e.target.value.trim();
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'text_input', data: text }));
                    // setFinalTranscripts(prev => [...prev, { role: 'user', text: text }]); // Removed to prevent duplication (backend echoes it)
                    e.target.value = '';
                  } else {
                    toast.error("Not connected");
                  }
                }
              }}
            />
            {/* Send Icon (only visible when typing) */}
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>

          {/* Mic Button with Volume Visualizer */}
          <button
            onClick={handleCallToggle}
            style={{
              boxShadow: isRecording ? `0 0 ${10 + volume}px ${Math.max(2, volume / 4)}px rgba(239, 68, 68, 0.6)` : undefined,
              transform: isRecording ? `scale(${1 + volume / 200})` : undefined
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-75 shadow-md flex-shrink-0 relative z-10 ${isRecording
              ? 'bg-red-500 text-white'
              : isConnected
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            disabled={!isConnected}
          >
            {isRecording ? <PhoneOff size={20} /> : <Phone size={20} />}
          </button>

        </div>
      </div>

      {/* Result Card */}

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md h-auto max-h-[85%] overflow-hidden flex flex-col border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Verify Identity</h3>
              <button
                onClick={() => setShowDocumentUpload(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div
              ref={modalScrollRef}
              className="flex-1 p-4 overflow-y-auto"
            >
              <FileUpload
                applicationId={applicationId}
                previousUploads={uploadedFiles}
                onUploadSuccess={(data, file) => {
                  toast.success("Verification Complete!");
                  // Add to list
                  setUploadedFiles(prev => [...prev, {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: data
                  }]);

                  // Force scroll to top to keep Dropzone in view
                  if (modalScrollRef.current) {
                    modalScrollRef.current.scrollTop = 0;
                  }

                  // Keep modal open so user can upload more files if needed
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'document_uploaded', data: data }));
                  }
                }}
              />
            </div>
            {/* Footer for multiple uploads */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col items-center">
              <p className="text-xs text-gray-500 mb-3 text-center">
                To upload another document, remove the current one using the 'X' button above.
              </p>
              <button
                onClick={() => setShowDocumentUpload(false)}
                className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Done / Finish Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAgentRealtime;
