// Copyright Epic Games, Inc. All Rights Reserved.
import { OptionParameters } from '../Config/Config';
import { WebRtcPlayerController } from '../WebRtcPlayer/WebRtcPlayerController';
import { Flags, NumericParameters } from '../Config/Config';
import { Logger } from '../Logger/Logger';
import { OnScreenKeyboard } from '../UI/OnScreenKeyboard';
import { EventEmitter, InitialSettingsEvent, LatencyTestResultEvent, StatsReceivedEvent, StreamLoadingEvent, VideoEncoderAvgQPEvent, VideoInitializedEvent, WebRtcAutoConnectEvent, WebRtcConnectedEvent, WebRtcConnectingEvent, WebRtcDisconnectedEvent, WebRtcFailedEvent, WebRtcSdpEvent } from '../Util/EventEmitter';
import { WebXRController } from '../WebXR/WebXRController';
/**
 * The key class for the browser side of a Pixel Streaming application, it includes:
 * WebRTC handling, XR support, input handling, and emitters for lifetime and state change events.
 * Users are encouraged to use this class as is, through composition, or extend it. In any case,
 * this will likely be the core of your Pixel Streaming experience in terms of functionality.
 */
export class PixelStreaming {
    /**
     * @param config - A newly instantiated config object
     * @param overrides - Parameters to override default behaviour
     * returns the base Pixel streaming object
     */
    constructor(config, overrides) {
        this._showActionOrErrorOnDisconnect = true;
        this.allowConsoleCommands = false;
        this.config = config;
        if (overrides === null || overrides === void 0 ? void 0 : overrides.videoElementParent) {
            this._videoElementParent = overrides.videoElementParent;
        }
        this._eventEmitter = new EventEmitter();
        this.configureSettings();
        // setup WebRTC
        this.setWebRtcPlayerController(new WebRtcPlayerController(this.config, this));
        // Onscreen keyboard
        this.onScreenKeyboardHelper = new OnScreenKeyboard(this.videoElementParent);
        this.onScreenKeyboardHelper.unquantizeAndDenormalizeUnsigned = (x, y) => this._webRtcController.requestUnquantizedAndDenormalizeUnsigned(x, y);
        this._activateOnScreenKeyboard = (command) => this.onScreenKeyboardHelper.showOnScreenKeyboard(command);
        this._webXrController = new WebXRController(this._webRtcController);
    }
    /**
     * Gets the element that contains the video stream element.
     */
    get videoElementParent() {
        if (!this._videoElementParent) {
            this._videoElementParent = document.createElement('div');
            this._videoElementParent.id = 'videoElementParent';
        }
        return this._videoElementParent;
    }
    /**
     * Configure the settings with on change listeners and any additional per experience settings.
     */
    configureSettings() {
        this.config._addOnSettingChangedListener(Flags.IsQualityController, (wantsQualityController) => {
            // If the setting has been set to true (either programatically or the user has flicked the toggle)
            // and we aren't currently quality controller, send the request
            if (wantsQualityController === true &&
                !this._webRtcController.isQualityController) {
                this._webRtcController.sendRequestQualityControlOwnership();
            }
        });
        this.config._addOnSettingChangedListener(Flags.AFKDetection, (isAFKEnabled) => {
            this._webRtcController.setAfkEnabled(isAFKEnabled);
        });
        this.config._addOnSettingChangedListener(Flags.MatchViewportResolution, () => {
            this._webRtcController.videoPlayer.updateVideoStreamSize();
        });
        this.config._addOnSettingChangedListener(Flags.HoveringMouseMode, (isHoveringMouse) => {
            this.config.setFlagLabel(Flags.HoveringMouseMode, `Control Scheme: ${isHoveringMouse ? 'Hovering' : 'Locked'} Mouse`);
            this._webRtcController.setMouseInputEnabled(this.config.isFlagEnabled(Flags.MouseInput));
        });
        // user input
        this.config._addOnSettingChangedListener(Flags.KeyboardInput, (isEnabled) => {
            this._webRtcController.setKeyboardInputEnabled(isEnabled);
        });
        this.config._addOnSettingChangedListener(Flags.MouseInput, (isEnabled) => {
            this._webRtcController.setMouseInputEnabled(isEnabled);
        });
        this.config._addOnSettingChangedListener(Flags.TouchInput, (isEnabled) => {
            this._webRtcController.setTouchInputEnabled(isEnabled);
        });
        this.config._addOnSettingChangedListener(Flags.GamepadInput, (isEnabled) => {
            this._webRtcController.setGamePadInputEnabled(isEnabled);
        });
        // encoder settings
        this.config._addOnNumericSettingChangedListener(NumericParameters.MinQP, (newValue) => {
            Logger.Log(Logger.GetStackTrace(), '--------  Sending MinQP  --------', 7);
            this._webRtcController.sendEncoderMinQP(newValue);
            Logger.Log(Logger.GetStackTrace(), '-------------------------------------------', 7);
        });
        this.config._addOnNumericSettingChangedListener(NumericParameters.MaxQP, (newValue) => {
            Logger.Log(Logger.GetStackTrace(), '--------  Sending encoder settings  --------', 7);
            this._webRtcController.sendEncoderMaxQP(newValue);
            Logger.Log(Logger.GetStackTrace(), '-------------------------------------------', 7);
        });
        // WebRTC settings
        this.config._addOnNumericSettingChangedListener(NumericParameters.WebRTCMinBitrate, (newValue) => {
            Logger.Log(Logger.GetStackTrace(), '--------  Sending web rtc settings  --------', 7);
            this._webRtcController.sendWebRTCMinBitrate(newValue * 1000 /* kbps to bps */);
            Logger.Log(Logger.GetStackTrace(), '-------------------------------------------', 7);
        });
        this.config._addOnNumericSettingChangedListener(NumericParameters.WebRTCMaxBitrate, (newValue) => {
            Logger.Log(Logger.GetStackTrace(), '--------  Sending web rtc settings  --------', 7);
            this._webRtcController.sendWebRTCMaxBitrate(newValue * 1000 /* kbps to bps */);
            Logger.Log(Logger.GetStackTrace(), '-------------------------------------------', 7);
        });
        this.config._addOnNumericSettingChangedListener(NumericParameters.WebRTCFPS, (newValue) => {
            Logger.Log(Logger.GetStackTrace(), '--------  Sending web rtc settings  --------', 7);
            this._webRtcController.sendWebRTCFps(newValue);
            Logger.Log(Logger.GetStackTrace(), '-------------------------------------------', 7);
        });
        this.config._addOnOptionSettingChangedListener(OptionParameters.PreferredCodec, (newValue) => {
            if (this._webRtcController) {
                this._webRtcController.setPreferredCodec(newValue);
            }
        });
        this.config._registerOnChangeEvents(this._eventEmitter);
    }
    /**
     * Activate the on screen keyboard when receiving the command from the streamer
     * @param command - the keyboard command
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _activateOnScreenKeyboard(command) {
        throw new Error('Method not implemented.');
    }
    /**
     * Set the input control ownership
     * @param inputControlOwnership - does the user have input control ownership
     */
    _onInputControlOwnership(inputControlOwnership) {
        this._inputController = inputControlOwnership;
    }
    /**
     * Instantiate the WebRTCPlayerController interface to provide WebRTCPlayerController functionality within this class and set up anything that requires it
     * @param webRtcPlayerController - a WebRtcPlayerController controller instance
     */
    setWebRtcPlayerController(webRtcPlayerController) {
        this._webRtcController = webRtcPlayerController;
        this._webRtcController.setPreferredCodec(this.config.getSettingOption(OptionParameters.PreferredCodec)
            .selected);
        this._webRtcController.resizePlayerStyle();
        // connect if auto connect flag is enabled
        this.checkForAutoConnect();
    }
    /**
     * Connect to signaling server.
     */
    connect() {
        this._webRtcController.connectToSignallingServer();
    }
    /**
     * Reconnects to the signaling server. If connection is up, disconnects first
     * before establishing a new connection
     */
    reconnect() {
        this._webRtcController.restartStreamAutomatically();
    }
    /**
     * Disconnect from the signaling server and close open peer connections.
     */
    disconnect() {
        this._webRtcController.close();
    }
    /**
     * Play the stream. Can be called only after a peer connection has been established.
     */
    play() {
        this._onStreamLoading();
        this._webRtcController.playStream();
    }
    /**
     * Auto connect if AutoConnect flag is enabled
     */
    checkForAutoConnect() {
        // set up if the auto play will be used or regular click to start
        if (this.config.isFlagEnabled(Flags.AutoConnect)) {
            // if autoplaying show an info overlay while while waiting for the connection to begin
            this._onWebRtcAutoConnect();
            this._webRtcController.connectToSignallingServer();
        }
    }
    /**
     * Emit an event on auto connecting
     */
    _onWebRtcAutoConnect() {
        this._eventEmitter.dispatchEvent(new WebRtcAutoConnectEvent());
        this._showActionOrErrorOnDisconnect = true;
    }
    /**
     * Set up functionality to happen when receiving a webRTC answer
     */
    _onWebRtcSdp() {
        this._eventEmitter.dispatchEvent(new WebRtcSdpEvent());
    }
    /**
     * Emits a StreamLoading event
     */
    _onStreamLoading() {
        this._eventEmitter.dispatchEvent(new StreamLoadingEvent());
    }
    /**
     * Event fired when the video is disconnected - emits given eventString or an override
     * message from webRtcController if one has been set
     * @param eventString - the event text that will be emitted
     */
    _onDisconnect(eventString) {
        // if we have overridden the default disconnection message, assign the new value here
        if (this._webRtcController.getDisconnectMessageOverride() != '' &&
            this._webRtcController.getDisconnectMessageOverride() !==
                undefined &&
            this._webRtcController.getDisconnectMessageOverride() != null) {
            eventString = this._webRtcController.getDisconnectMessageOverride();
            this._webRtcController.setDisconnectMessageOverride('');
        }
        this._eventEmitter.dispatchEvent(new WebRtcDisconnectedEvent({
            eventString,
            showActionOrErrorOnDisconnect: this._showActionOrErrorOnDisconnect
        }));
        if (this._showActionOrErrorOnDisconnect == false) {
            this._showActionOrErrorOnDisconnect = true;
        }
    }
    /**
     * Handles when Web Rtc is connecting
     */
    _onWebRtcConnecting() {
        this._eventEmitter.dispatchEvent(new WebRtcConnectingEvent());
    }
    /**
     * Handles when Web Rtc has connected
     */
    _onWebRtcConnected() {
        this._eventEmitter.dispatchEvent(new WebRtcConnectedEvent());
    }
    /**
     * Handles when Web Rtc fails to connect
     */
    _onWebRtcFailed() {
        this._eventEmitter.dispatchEvent(new WebRtcFailedEvent());
    }
    /**
     * Handle when the Video has been Initialized
     */
    _onVideoInitialized() {
        this._eventEmitter.dispatchEvent(new VideoInitializedEvent());
        this._videoStartTime = Date.now();
    }
    /**
     * Set up functionality to happen when receiving latency test results
     * @param latency - latency test results object
     */
    _onLatencyTestResult(latencyTimings) {
        this._eventEmitter.dispatchEvent(new LatencyTestResultEvent({ latencyTimings }));
    }
    /**
     * Set up functionality to happen when receiving video statistics
     * @param videoStats - video statistics as a aggregate stats object
     */
    _onVideoStats(videoStats) {
        // Duration
        if (!this._videoStartTime || this._videoStartTime === undefined) {
            this._videoStartTime = Date.now();
        }
        videoStats.handleSessionStatistics(this._videoStartTime, this._inputController, this._webRtcController.videoAvgQp);
        this._eventEmitter.dispatchEvent(new StatsReceivedEvent({ aggregatedStats: videoStats }));
    }
    /**
     * Set up functionality to happen when calculating the average video encoder qp
     * @param QP - the quality number of the stream
     */
    _onVideoEncoderAvgQP(QP) {
        this._eventEmitter.dispatchEvent(new VideoEncoderAvgQPEvent({ avgQP: QP }));
    }
    /**
     * Set up functionality to happen when receiving and handling initial settings for the UE app
     * @param settings - initial UE app settings
     */
    _onInitialSettings(settings) {
        var _a;
        this._eventEmitter.dispatchEvent(new InitialSettingsEvent({ settings }));
        if (settings.PixelStreamingSettings) {
            this.allowConsoleCommands =
                (_a = settings.PixelStreamingSettings.AllowPixelStreamingCommands) !== null && _a !== void 0 ? _a : false;
            if (this.allowConsoleCommands === false) {
                Logger.Info(Logger.GetStackTrace(), '-AllowPixelStreamingCommands=false, sending arbitrary console commands from browser to UE is disabled.');
            }
        }
        const useUrlParams = this.config.useUrlParams;
        const urlParams = new URLSearchParams(window.location.search);
        if (settings.EncoderSettings) {
            this.config.setNumericSetting(NumericParameters.MinQP, 
            // If a setting is set in the URL, make sure we respect that value as opposed to what the application sends us
            (useUrlParams && urlParams.has(NumericParameters.MinQP))
                ? Number.parseInt(urlParams.get(NumericParameters.MinQP))
                : settings.EncoderSettings.MinQP);
            this.config.setNumericSetting(NumericParameters.MaxQP, (useUrlParams && urlParams.has(NumericParameters.MaxQP))
                ? Number.parseInt(urlParams.get(NumericParameters.MaxQP))
                : settings.EncoderSettings.MaxQP);
        }
        if (settings.WebRTCSettings) {
            this.config.setNumericSetting(NumericParameters.WebRTCMinBitrate, (useUrlParams && urlParams.has(NumericParameters.WebRTCMinBitrate))
                ? Number.parseInt(urlParams.get(NumericParameters.WebRTCMinBitrate)) / 1000 /* bps to kbps */
                : settings.WebRTCSettings.MinBitrate / 1000 /* bps to kbps */);
            this.config.setNumericSetting(NumericParameters.WebRTCMaxBitrate, (useUrlParams && urlParams.has(NumericParameters.WebRTCMaxBitrate))
                ? Number.parseInt(urlParams.get(NumericParameters.WebRTCMaxBitrate)) / 1000 /* bps to kbps */
                : settings.WebRTCSettings.MaxBitrate / 1000 /* bps to kbps */);
            this.config.setNumericSetting(NumericParameters.WebRTCFPS, (useUrlParams && urlParams.has(NumericParameters.WebRTCFPS))
                ? Number.parseInt(urlParams.get(NumericParameters.WebRTCFPS))
                : settings.WebRTCSettings.FPS);
        }
    }
    /**
     * Set up functionality to happen when setting quality control ownership of a stream
     * @param hasQualityOwnership - does this user have quality ownership of the stream true / false
     */
    _onQualityControlOwnership(hasQualityOwnership) {
        this.config.setFlagEnabled(Flags.IsQualityController, hasQualityOwnership);
    }
    /**
     * Request a connection latency test.
     * NOTE: There are plans to refactor all request* functions. Expect changes if you use this!
     * @returns
     */
    requestLatencyTest() {
        if (!this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        this._webRtcController.sendLatencyTest();
        return true;
    }
    /**
     * Request for the UE application to show FPS counter.
     * NOTE: There are plans to refactor all request* functions. Expect changes if you use this!
     * @returns
     */
    requestShowFps() {
        if (!this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        this._webRtcController.sendShowFps();
        return true;
    }
    /**
     * Request for a new IFrame from the UE application.
     * NOTE: There are plans to refactor all request* functions. Expect changes if you use this!
     * @returns
     */
    requestIframe() {
        if (!this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        this._webRtcController.sendIframeRequest();
        return true;
    }
    /**
     * Send data to UE application. The data will be run through JSON.stringify() so e.g. strings
     * and any serializable plain JSON objects with no recurrence can be sent.
     * @returns true if succeeded, false if rejected
     */
    emitUIInteraction(descriptor) {
        if (!this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        this._webRtcController.emitUIInteraction(descriptor);
        return true;
    }
    /**
     * Send a command to UE application. Blocks ConsoleCommand descriptors unless UE
     * has signaled that it allows console commands.
     * @returns true if succeeded, false if rejected
     */
    emitCommand(descriptor) {
        if (!this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        if (!this.allowConsoleCommands && 'ConsoleCommand' in descriptor) {
            return false;
        }
        this._webRtcController.emitCommand(descriptor);
        return true;
    }
    /**
     * Send a console command to UE application. Only allowed if UE has signaled that it allows
     * console commands.
     * @returns true if succeeded, false if rejected
     */
    emitConsoleCommand(command) {
        if (!this.allowConsoleCommands || !this._webRtcController.videoPlayer.isVideoReady()) {
            return false;
        }
        this._webRtcController.emitConsoleCommand(command);
        return true;
    }
    /**
     * Add a UE -> browser response event listener
     * @param name - The name of the response handler
     * @param listener - The method to be activated when a message is received
     */
    addResponseEventListener(name, listener) {
        this._webRtcController.responseController.addResponseEventListener(name, listener);
    }
    /**
     * Remove a UE -> browser response event listener
     * @param name - The name of the response handler
     */
    removeResponseEventListener(name) {
        this._webRtcController.responseController.removeResponseEventListener(name);
    }
    /**
     * Dispatch a new event.
     * @param e event
     * @returns
     */
    dispatchEvent(e) {
        return this._eventEmitter.dispatchEvent(e);
    }
    /**
     * Register an event handler.
     * @param type event name
     * @param listener event handler function
     */
    addEventListener(type, listener) {
        this._eventEmitter.addEventListener(type, listener);
    }
    /**
     * Remove an event handler.
     * @param type event name
     * @param listener event handler function
     */
    removeEventListener(type, listener) {
        this._eventEmitter.removeEventListener(type, listener);
    }
    /**
     * Enable/disable XR mode.
     */
    toggleXR() {
        this.webXrController.xrClicked();
    }
    /**
     * Pass in a function to generate a signalling server URL.
     * This function is useful if you need to programmatically construct your signalling server URL.
     * @param signallingUrlBuilderFunc A function that generates a signalling server url.
     */
    setSignallingUrlBuilder(signallingUrlBuilderFunc) {
        this._webRtcController.signallingUrlBuilder = signallingUrlBuilderFunc;
    }
    /**
     * Public getter for the websocket controller. Access to this property allows you to send
     * custom websocket messages.
     */
    get webSocketController() {
        return this._webRtcController.webSocketController;
    }
    /**
     * Public getter for the webXrController controller. Used for all XR features.
     */
    get webXrController() {
        return this._webXrController;
    }
}
//# sourceMappingURL=PixelStreaming.js.map