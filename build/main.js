"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var mqtt = __toESM(require("mqtt"));
class Espresence extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "espresence"
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    async onReady() {
        const adapter = this;
        const adapterLog = this.log;
        const adapterConfig = this.config;
        const options = {
            clean: true,
            connectTimeout: 4e3,
            protocolVersion: 3,
            protocolId: "MQIsdp",
            clientId: "ESPresence." + this.instance,
            username: adapterConfig.user,
            password: adapterConfig.password
        };
        adapterLog.info(`Connecting to MQTT broker [${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}], user:[${adapterConfig.user}], password:[***]`);
        const client = mqtt.connect(`mqtt://${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}`, options);
        client.on("connect", function(connACK) {
            if (connACK.returnCode === 0) {
                adapterLog.info(`MQTT connection to broker [${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}] established.`);
                client.subscribe("/#", function(err) {
                    if (!err) {
                        adapterLog.info(`Subscribed to all topics.`);
                    } else {
                        adapterLog.info(`Error during subscription: ${JSON.stringify(err)}`);
                    }
                });
            } else {
                adapterLog.info(`Error during connect: ${JSON.stringify(connACK)}`);
            }
        });
        client.on("message", function(topic, payload) {
            adapterLog.debug(`MQTT topic [${topic}] received message: ${payload.toString()}`);
            adapter.processMsg(adapter, topic, payload);
        });
        client.on("error", function(error) {
            adapterLog.debug("MQTT server returned error: " + error);
        });
        client.on("reconnect", function() {
            adapterLog.info("Reconnecting to mqtt server.");
        });
        client.on("close", function() {
            adapterLog.info("Disconnected from mqtt server.");
        });
        client.on("offline", function() {
            adapterLog.info("MQTT offline.");
        });
    }
    isJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    isNumber(str) {
        return !Number.isNaN(Number.parseFloat(str));
    }
    processMsg(adapter, topic, payload) {
        let value = payload.toString();
        const objData = {
            type: "state",
            common: {
                "name": topic.split("/").pop(),
                "read": true,
                "write": false,
                "role": "value",
                "type": "string"
            },
            native: {}
        };
        if (adapter.isJsonString(value)) {
            const jPayload = JSON.parse(value);
            objData.type = "folder";
            objData.role = "";
            adapter.processMsg(adapter, topic, objData, jPayload);
        }
        if (adapter.isNumber(value)) {
            objData.type = "number";
            value = Number.parseFloat(value);
        }
        adapter.createOrExtendObject(adapter, topic.split("/").join("."), objData, value);
    }
    createOrExtendObject(adapter, id, objData, value) {
        adapter.getObject(id, function(err, oldObj) {
            if (!err && oldObj) {
                if (objData.name === oldObj.common.name) {
                    adapter.setState(id, value, true);
                } else {
                    adapter.extendObject(id, objData, () => {
                        adapter.setState(id, value, true);
                    });
                }
            } else {
                adapter.setObjectNotExists(id, objData, () => {
                    adapter.setState(id, value, true);
                });
            }
        });
    }
    onUnload(callback) {
        try {
            callback();
        } catch (e) {
            callback();
        }
    }
    onStateChange(id, state) {
        if (state) {
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            this.log.info(`state ${id} deleted`);
        }
    }
}
if (require.main !== module) {
    module.exports = (options) => new Espresence(options);
} else {
    (() => new Espresence())();
}
//# sourceMappingURL=main.js.map
