// Copyright Epic Games, Inc. All Rights Reserved.
import { FakeTouchController } from './FakeTouchController';
import { KeyboardController } from './KeyboardController';
import { MouseController } from './MouseController';
import { TouchController } from './TouchController';
import { GamePadController } from './GamepadController';
import { ControlSchemeType } from '../Config/Config';
import { Logger } from '../Logger/Logger';
/**
 * Class for making and setting up input class types
 */
export class InputClassesFactory {
    /**
     * @param toStreamerMessagesProvider - Stream message instance
     * @param videoElementProvider - Video Player instance
     * @param coordinateConverter - A coordinateConverter instance
     */
    constructor(toStreamerMessagesProvider, videoElementProvider, coordinateConverter) {
        this.activeKeys = new ActiveKeys();
        this.toStreamerMessagesProvider = toStreamerMessagesProvider;
        this.videoElementProvider = videoElementProvider;
        this.coordinateConverter = coordinateConverter;
    }
    /**
     * Registers browser key events.
     */
    registerKeyBoard(config) {
        Logger.Log(Logger.GetStackTrace(), 'Register Keyboard Events', 7);
        const keyboardController = new KeyboardController(this.toStreamerMessagesProvider, config, this.activeKeys);
        keyboardController.registerKeyBoardEvents();
        return keyboardController;
    }
    /**
     * register mouse events based on a control type
     * @param controlScheme - if the mouse is either hovering or locked
     */
    registerMouse(controlScheme) {
        Logger.Log(Logger.GetStackTrace(), 'Register Mouse Events', 7);
        const mouseController = new MouseController(this.toStreamerMessagesProvider, this.videoElementProvider, this.coordinateConverter, this.activeKeys);
        switch (controlScheme) {
            case ControlSchemeType.HoveringMouse:
                mouseController.registerHoveringMouseEvents(mouseController);
                break;
            default:
                Logger.Info(Logger.GetStackTrace(), 'unknown Control Scheme Type Defaulting to Locked Mouse Events');
                mouseController.registerHoveringMouseEvents(mouseController);
                break;
        }
        return mouseController;
    }
    /**
     * register touch events
     * @param fakeMouseTouch - the faked mouse touch event
     */
    registerTouch(fakeMouseTouch, videoElementParentClientRect) {
        Logger.Log(Logger.GetStackTrace(), 'Registering Touch', 6);
        if (fakeMouseTouch) {
            const fakeTouchController = new FakeTouchController(this.toStreamerMessagesProvider, this.videoElementProvider, this.coordinateConverter);
            fakeTouchController.setVideoElementParentClientRect(videoElementParentClientRect);
            return fakeTouchController;
        }
        else {
            return new TouchController(this.toStreamerMessagesProvider, this.videoElementProvider, this.coordinateConverter);
        }
    }
    /**
     * registers a gamepad
     */
    registerGamePad() {
        Logger.Log(Logger.GetStackTrace(), 'Register Game Pad', 7);
        const gamePadController = new GamePadController(this.toStreamerMessagesProvider);
        return gamePadController;
    }
}
/**
 * A class that keeps track of current active keys
 */
export class ActiveKeys {
    constructor() {
        this.activeKeys = [];
        this.activeKeys = [];
    }
    /**
     * Get the current array of active keys
     * @returns - an array of active keys
     */
    getActiveKeys() {
        return this.activeKeys;
    }
}
//# sourceMappingURL=InputClassesFactory.js.map