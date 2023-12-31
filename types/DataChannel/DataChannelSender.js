// Copyright Epic Games, Inc. All Rights Reserved.
import { Logger } from '../Logger/Logger';
/**
 * A class for sending data channel messages
 */
export class DataChannelSender {
    /**
     * @param dataChannelProvider - Data channel object type
     */
    constructor(dataChannelProvider) {
        this.dataChannelProvider = dataChannelProvider;
    }
    canSend() {
        return (this.dataChannelProvider.getDataChannelInstance().dataChannel !==
            undefined &&
            this.dataChannelProvider.getDataChannelInstance().dataChannel
                .readyState == 'open');
    }
    /**
     * Send Data over the Data channel to the UE Instance
     * @param data - Message Data Array Buffer
     */
    sendData(data) {
        // reset the afk inactivity
        const dataChannelInstance = this.dataChannelProvider.getDataChannelInstance();
        if (dataChannelInstance.dataChannel.readyState == 'open') {
            dataChannelInstance.dataChannel.send(data);
            Logger.Log(Logger.GetStackTrace(), `Message Sent: ${new Uint8Array(data)}`, 6);
            this.resetAfkWarningTimerOnDataSend();
        }
        else {
            Logger.Error(Logger.GetStackTrace(), `Message Failed: ${new Uint8Array(data)}`);
        }
    }
    /**
     * An override method for resetting the Afk warning timer when data is sent over the data channel
     */
    resetAfkWarningTimerOnDataSend() {
        // Base Functionality: Do Nothing
    }
}
//# sourceMappingURL=DataChannelSender.js.map