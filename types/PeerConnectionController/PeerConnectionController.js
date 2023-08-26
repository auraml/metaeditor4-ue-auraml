// Copyright Epic Games, Inc. All Rights Reserved.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Logger } from '../Logger/Logger';
import { OptionParameters, Flags } from '../Config/Config';
import { AggregatedStats } from './AggregatedStats';
import { parseRtpParameters, splitSections } from 'sdp';
/**
 * Handles the Peer Connection
 */
export class PeerConnectionController {
    /**
     * Create a new RTC Peer Connection client
     * @param options - Peer connection Options
     * @param config - The config for our PS experience.
     */
    constructor(options, config, preferredCodec) {
        this.config = config;
        this.createPeerConnection(options, preferredCodec);
    }
    createPeerConnection(options, preferredCodec) {
        // Set the ICE transport to relay if TURN enabled
        if (this.config.isFlagEnabled(Flags.ForceTURN)) {
            options.iceTransportPolicy = 'relay';
            Logger.Log(Logger.GetStackTrace(), 'Forcing TURN usage by setting ICE Transport Policy in peer connection config.');
        }
        // build a new peer connection with the options
        this.peerConnection = new RTCPeerConnection(options);
        this.peerConnection.onsignalingstatechange = (ev) => this.handleSignalStateChange(ev);
        this.peerConnection.oniceconnectionstatechange = (ev) => this.handleIceConnectionStateChange(ev);
        this.peerConnection.onicegatheringstatechange = (ev) => this.handleIceGatheringStateChange(ev);
        this.peerConnection.ontrack = (ev) => this.handleOnTrack(ev);
        this.peerConnection.onicecandidate = (ev) => this.handleIceCandidate(ev);
        this.peerConnection.ondatachannel = (ev) => this.handleDataChannel(ev);
        this.aggregatedStats = new AggregatedStats();
        this.preferredCodec = preferredCodec;
        this.updateCodecSelection = true;
    }
    /**
     * Create an offer for the Web RTC handshake and send the offer to the signaling server via websocket
     * @param offerOptions - RTC Offer Options
     */
    createOffer(offerOptions, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger.Log(Logger.GetStackTrace(), 'Create Offer', 6);
            const isLocalhostConnection = location.hostname === 'localhost' ||
                location.hostname === '127.0.0.1';
            const isHttpsConnection = location.protocol === 'https:';
            let useMic = config.isFlagEnabled(Flags.UseMic);
            if (useMic && !(isLocalhostConnection || isHttpsConnection)) {
                useMic = false;
                Logger.Error(Logger.GetStackTrace(), 'Microphone access in the browser will not work if you are not on HTTPS or localhost. Disabling mic access.');
                Logger.Error(Logger.GetStackTrace(), "For testing you can enable HTTP microphone access Chrome by visiting chrome://flags/ and enabling 'unsafely-treat-insecure-origin-as-secure'");
            }
            this.setupTransceiversAsync(useMic).finally(() => {
                var _a;
                (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.createOffer(offerOptions).then((offer) => {
                    var _a;
                    this.showTextOverlayConnecting();
                    offer.sdp = this.mungeSDP(offer.sdp, useMic);
                    (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.setLocalDescription(offer);
                    this.onSendWebRTCOffer(offer);
                }).catch(() => {
                    this.showTextOverlaySetupFailure();
                });
            });
        });
    }
    /**
     *
     */
    receiveOffer(offer, config) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            Logger.Log(Logger.GetStackTrace(), 'Receive Offer', 6);
            (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.setRemoteDescription(offer).then(() => {
                const isLocalhostConnection = location.hostname === 'localhost' ||
                    location.hostname === '127.0.0.1';
                const isHttpsConnection = location.protocol === 'https:';
                let useMic = config.isFlagEnabled(Flags.UseMic);
                if (useMic && !(isLocalhostConnection || isHttpsConnection)) {
                    useMic = false;
                    Logger.Error(Logger.GetStackTrace(), 'Microphone access in the browser will not work if you are not on HTTPS or localhost. Disabling mic access.');
                    Logger.Error(Logger.GetStackTrace(), "For testing you can enable HTTP microphone access Chrome by visiting chrome://flags/ and enabling 'unsafely-treat-insecure-origin-as-secure'");
                }
                this.setupTransceiversAsync(useMic).finally(() => {
                    var _a;
                    (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.createAnswer().then((Answer) => {
                        var _a;
                        Answer.sdp = this.mungeSDP(Answer.sdp, useMic);
                        return (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.setLocalDescription(Answer);
                    }).then(() => {
                        var _a;
                        this.onSendWebRTCAnswer((_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.currentLocalDescription);
                    }).catch(() => {
                        Logger.Error(Logger.GetStackTrace(), 'createAnswer() failed');
                    });
                });
            });
            // Ugly syntax, but this achieves the intersection of the browser supported list and the UE supported list
            this.config.setOptionSettingOptions(OptionParameters.PreferredCodec, this.parseAvailableCodecs(offer).filter((value) => this.config
                .getSettingOption(OptionParameters.PreferredCodec)
                .options.includes(value)));
        });
    }
    /**
     * Set the Remote Descriptor from the signaling server to the RTC Peer Connection
     * @param answer - RTC Session Descriptor from the Signaling Server
     */
    receiveAnswer(answer) {
        var _a;
        (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.setRemoteDescription(answer);
        // Ugly syntax, but this achieves the intersection of the browser supported list and the UE supported list
        this.config.setOptionSettingOptions(OptionParameters.PreferredCodec, this.parseAvailableCodecs(answer).filter((value) => this.config
            .getSettingOption(OptionParameters.PreferredCodec)
            .options.includes(value)));
    }
    /**
     * Generate Aggregated Stats and then fire a onVideo Stats event
     */
    generateStats() {
        var _a;
        (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.getStats(null).then((StatsData) => {
            this.aggregatedStats.processStats(StatsData);
            this.onVideoStats(this.aggregatedStats);
            // Update the preferred codec selection based on what was actually negotiated
            if (this.updateCodecSelection) {
                this.config.setOptionSettingValue(OptionParameters.PreferredCodec, this.aggregatedStats.codecs.get(this.aggregatedStats.inboundVideoStats.codecId));
            }
        });
    }
    /**
     * Close The Peer Connection
     */
    close() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
    /**
     * Modify the Session Descriptor
     * @param sdp - Session Descriptor as a string
     * @param useMic - Is the microphone in use
     * @returns A modified Session Descriptor
     */
    mungeSDP(sdp, useMic) {
        const mungedSDP = sdp;
        mungedSDP.replace(/(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm, '$1;x-google-start-bitrate=10000;x-google-max-bitrate=100000\r\n');
        let audioSDP = '';
        // set max bitrate to highest bitrate Opus supports
        audioSDP += 'maxaveragebitrate=510000;';
        if (useMic) {
            // set the max capture rate to 48khz (so we can send high quality audio from mic)
            audioSDP += 'sprop-maxcapturerate=48000;';
        }
        // Force mono or stereo based on whether ?forceMono was passed or not
        audioSDP += this.config.isFlagEnabled(Flags.ForceMonoAudio)
            ? 'stereo=0;'
            : 'stereo=1;';
        // enable in-band forward error correction for opus audio
        audioSDP += 'useinbandfec=1';
        // We use the line 'useinbandfec=1' (which Opus uses) to set our Opus specific audio parameters.
        mungedSDP.replace('useinbandfec=1', audioSDP);
        return mungedSDP;
    }
    /**
     * When a Ice Candidate is received add to the RTC Peer Connection
     * @param iceCandidate - RTC Ice Candidate from the Signaling Server
     */
    handleOnIce(iceCandidate) {
        var _a;
        Logger.Log(Logger.GetStackTrace(), 'peerconnection handleOnIce', 6);
        // // if forcing TURN, reject any candidates not relay
        if (this.config.isFlagEnabled(Flags.ForceTURN)) {
            // check if no relay address is found, if so, we are assuming it means no TURN server
            if (iceCandidate.candidate.indexOf('relay') < 0) {
                Logger.Info(Logger.GetStackTrace(), `Dropping candidate because it was not TURN relay. | Type= ${iceCandidate.type} | Protocol= ${iceCandidate.protocol} | Address=${iceCandidate.address} | Port=${iceCandidate.port} |`, 6);
                return;
            }
        }
        (_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.addIceCandidate(iceCandidate);
    }
    /**
     * When the RTC Peer Connection Signaling server state Changes
     * @param state - Signaling Server State Change Event
     */
    handleSignalStateChange(state) {
        Logger.Log(Logger.GetStackTrace(), 'signaling state change: ' + state, 6);
    }
    /**
     * Handle when the Ice Connection State Changes
     * @param state - Ice Connection State
     */
    handleIceConnectionStateChange(state) {
        Logger.Log(Logger.GetStackTrace(), 'ice connection state change: ' + state, 6);
        this.onIceConnectionStateChange(state);
    }
    /**
     * Handle when the Ice Gathering State Changes
     * @param state - Ice Gathering State Change
     */
    handleIceGatheringStateChange(state) {
        Logger.Log(Logger.GetStackTrace(), 'ice gathering state change: ' + JSON.stringify(state), 6);
    }
    /**
     * Activates the onTrack method
     * @param event - The webRtc track event
     */
    handleOnTrack(event) {
        this.onTrack(event);
    }
    /**
     * Activates the onPeerIceCandidate
     * @param event - The peer ice candidate
     */
    handleIceCandidate(event) {
        this.onPeerIceCandidate(event);
    }
    /**
     * Activates the onDataChannel
     * @param event - The peer's data channel
     */
    handleDataChannel(event) {
        this.onDataChannel(event);
    }
    /**
     * An override method for onTrack for use outside of the PeerConnectionController
     * @param trackEvent - The webRtc track event
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onTrack(trackEvent) {
        // Default Functionality: Do Nothing
    }
    /**
     * An override method for onIceConnectionStateChange for use outside of the PeerConnectionController
     * @param event - The webRtc iceconnectionstatechange event
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onIceConnectionStateChange(event) {
        // Default Functionality: Do Nothing
    }
    /**
     * An override method for onPeerIceCandidate for use outside of the PeerConnectionController
     * @param peerConnectionIceEvent - The peer ice candidate
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onPeerIceCandidate(peerConnectionIceEvent) {
        // Default Functionality: Do Nothing
    }
    /**
     * An override method for onDataChannel for use outside of the PeerConnectionController
     * @param datachannelEvent - The peer's data channel
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onDataChannel(datachannelEvent) {
        // Default Functionality: Do Nothing
    }
    /**
     * Setup tracks on the RTC Peer Connection
     * @param useMic - is mic in use
     */
    setupTransceiversAsync(useMic) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __awaiter(this, void 0, void 0, function* () {
            const hasTransceivers = ((_a = this.peerConnection) === null || _a === void 0 ? void 0 : _a.getTransceivers().length) > 0;
            // Setup a transceiver for getting UE video
            (_b = this.peerConnection) === null || _b === void 0 ? void 0 : _b.addTransceiver('video', { direction: 'recvonly' });
            // We can only set preferrec codec on Chrome
            if (RTCRtpReceiver.getCapabilities && this.preferredCodec != '') {
                for (const transceiver of (_d = (_c = this.peerConnection) === null || _c === void 0 ? void 0 : _c.getTransceivers()) !== null && _d !== void 0 ? _d : []) {
                    if (transceiver &&
                        transceiver.receiver &&
                        transceiver.receiver.track &&
                        transceiver.receiver.track.kind === 'video') {
                        const codecs = [];
                        if (this.preferredCodec) {
                            const preferredRTPCodec = this.preferredCodec.split(' ');
                            codecs.push({
                                mimeType: 'video/' + preferredRTPCodec[0] /* Name */,
                                clockRate: 90000,
                                sdpFmtpLine: preferredRTPCodec[1] /* sdpFmtpLine */
                                    ? preferredRTPCodec[1]
                                    : ''
                            });
                        }
                        this.config
                            .getSettingOption(OptionParameters.PreferredCodec)
                            .options.filter((option) => {
                            // Remove the preferred codec from the list of possible codecs as we've set it already
                            return option != this.preferredCodec;
                        })
                            .forEach((option) => {
                            // Ammend the rest of the browsers supported codecs
                            const altCodec = option.split(' ');
                            codecs.push({
                                mimeType: 'video/' + altCodec[0] /* Name */,
                                clockRate: 90000,
                                sdpFmtpLine: altCodec[1] /* sdpFmtpLine */
                                    ? altCodec[1]
                                    : ''
                            });
                        });
                        for (const codec of codecs) {
                            if (codec.sdpFmtpLine === '') {
                                // We can't dynamically add members to the codec, so instead remove the field if it's empty
                                delete codec.sdpFmtpLine;
                            }
                        }
                        transceiver.setCodecPreferences(codecs);
                    }
                }
            }
            // Setup a transceiver for sending mic audio to UE and receiving audio from UE
            if (!useMic) {
                (_e = this.peerConnection) === null || _e === void 0 ? void 0 : _e.addTransceiver('audio', {
                    direction: 'recvonly'
                });
            }
            else {
                // set the audio options based on mic usage
                const audioOptions = useMic
                    ? {
                        autoGainControl: false,
                        channelCount: 1,
                        echoCancellation: false,
                        latency: 0,
                        noiseSuppression: false,
                        sampleRate: 48000,
                        sampleSize: 16,
                        volume: 1.0
                    }
                    : false;
                // set the media send options
                const mediaSendOptions = {
                    video: false,
                    audio: audioOptions
                };
                // Note using mic on android chrome requires SSL or chrome://flags/ "unsafely-treat-insecure-origin-as-secure"
                const stream = yield navigator.mediaDevices.getUserMedia(mediaSendOptions);
                if (stream) {
                    if (hasTransceivers) {
                        for (const transceiver of (_g = (_f = this.peerConnection) === null || _f === void 0 ? void 0 : _f.getTransceivers()) !== null && _g !== void 0 ? _g : []) {
                            if (transceiver &&
                                transceiver.receiver &&
                                transceiver.receiver.track &&
                                transceiver.receiver.track.kind === 'audio') {
                                for (const track of stream.getTracks()) {
                                    if (track.kind && track.kind == 'audio') {
                                        transceiver.sender.replaceTrack(track);
                                        transceiver.direction = 'sendrecv';
                                    }
                                }
                            }
                        }
                    }
                    else {
                        for (const track of stream.getTracks()) {
                            if (track.kind && track.kind == 'audio') {
                                (_h = this.peerConnection) === null || _h === void 0 ? void 0 : _h.addTransceiver(track, {
                                    direction: 'sendrecv'
                                });
                            }
                        }
                    }
                }
                else {
                    (_j = this.peerConnection) === null || _j === void 0 ? void 0 : _j.addTransceiver('audio', {
                        direction: 'recvonly'
                    });
                }
            }
        });
    }
    /**
     * And override event for when the video stats are fired
     * @param event - Aggregated Stats
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onVideoStats(event) {
        // Default Functionality: Do Nothing
    }
    /**
     * Event to send the RTC offer to the Signaling server
     * @param offer - RTC Offer
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onSendWebRTCOffer(offer) {
        // Default Functionality: Do Nothing
    }
    /**
     * Event to send the RTC Answer to the Signaling server
     * @param answer - RTC Answer
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onSendWebRTCAnswer(answer) {
        // Default Functionality: Do Nothing
    }
    /**
     * An override for showing the Peer connection connecting Overlay
     */
    showTextOverlayConnecting() {
        // Default Functionality: Do Nothing
    }
    /**
     * An override for showing the Peer connection Failed overlay
     */
    showTextOverlaySetupFailure() {
        // Default Functionality: Do Nothing
    }
    parseAvailableCodecs(rtcSessionDescription) {
        // No point in updating the available codecs if on FF
        if (!RTCRtpReceiver.getCapabilities)
            return ['Only available on Chrome'];
        const ueSupportedCodecs = [];
        const sections = splitSections(rtcSessionDescription.sdp);
        // discard the session information as we only want media related info
        sections.shift();
        sections.forEach((mediaSection) => {
            const { codecs } = parseRtpParameters(mediaSection);
            // Filter only for VPX / H26X / AV1
            const matcher = /(VP\d|H26\d|AV1).*/;
            codecs.forEach((c) => {
                const str = c.name +
                    ' ' +
                    Object.keys(c.parameters || {})
                        .map((p) => p + '=' + c.parameters[p])
                        .join(';');
                const match = matcher.exec(str);
                if (match !== null) {
                    if (c.name == 'VP9') {
                        // UE answers don't specify profile but we know we want profile 0
                        c.parameters = {
                            'profile-id': '0'
                        };
                    }
                    const codecStr = c.name +
                        ' ' +
                        Object.keys(c.parameters || {})
                            .map((p) => p + '=' + c.parameters[p])
                            .join(';');
                    ueSupportedCodecs.push(codecStr);
                }
            });
        });
        return ueSupportedCodecs;
    }
}
//# sourceMappingURL=PeerConnectionController.js.map