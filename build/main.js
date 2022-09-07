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
    this._presence = {};
    this._timeouts = {};
  }
  initRoom(room) {
    this._presence[room] = [];
  }
  getPeopleInRoom(room) {
    return this._presence[room].length;
  }
  getPresenceInRoom(room) {
    return this._presence[room].length > 0;
  }
  getNamesInRoom(room) {
    return this._presence[room].join(",");
  }
  setNamesInRoom(room, newJoiner) {
    if (!this._presence[room].includes(newJoiner)) {
      this._presence[room].push(newJoiner);
      Object.keys(this._presence).forEach((key) => {
        this.log.debug(`Testing whether ${newJoiner} is in room ${key}`);
        if (key != room) {
          if (this.isPersonInRoom(newJoiner, key)) {
            this.removeNameFromRoom(key, newJoiner);
          }
        }
      });
    }
    this._presence[room].lastSeen = new Date();
  }
  isPersonInRoom(person, room) {
    return this._presence[room].includes(person);
  }
  removeNameFromRoom(room, name) {
    if (typeof this._presence[room] === "undefined")
      return;
    const index = this._presence[room].indexOf(name);
    if (index > -1) {
      this._presence[room].splice(index, 1);
    }
  }
  async onReady() {
    this.setup(this);
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
    adapterLog.warn(`Adapter configuration: ${JSON.stringify(adapterConfig)}`);
    adapterLog.info(`Connecting to MQTT broker [${adapterConfig.broker}:${adapterConfig.port}]`);
    const client = mqtt.connect(`mqtt://${adapterConfig.broker}:${adapterConfig.port}`, options);
    client.on("connect", function(connACK) {
      if (connACK.returnCode === 0) {
        adapterLog.info(`MQTT connection to broker [${adapterConfig.broker}:${adapterConfig.port}] established.`);
        client.subscribe("#", function(err, granted) {
          if (err) {
            adapterLog.error(`Error during subscription: ${JSON.stringify(err)}`);
          } else {
            adapterLog.debug(`Subscribed to topic ${granted[0].topic}.`);
          }
        });
      } else {
        adapterLog.info(`Error during connect: ${JSON.stringify(connACK)}`);
      }
    });
    client.on("message", function(topic, payload) {
      adapterLog.debug(`MQTT topic [${topic}] received message: ${payload.toString()}`);
      const topicArray = topic.split("/");
      const baseTopic = topicArray.shift();
      const level2Topic = topicArray.shift();
      const newTopic = topicArray.join(".");
      let room = null;
      if (level2Topic === "rooms") {
        const room2 = topicArray.shift();
        if (adapter._presence[room2]) {
          return;
        } else {
          adapter.initRoom(room2);
          adapter.setPresenceInRoom(adapter, room2);
        }
      }
      if (level2Topic === "devices") {
        room = topicArray.pop();
        if (!adapter._presence[room])
          return;
        const device = topicArray.pop() || "NoDevice";
        const newJoiner = adapter.getUserByBTLEID(adapterConfig, device);
        if (newJoiner && room) {
          clearInterval(adapter._timeouts[`${room}_${newJoiner}`]);
          adapter.setNamesInRoom(room, newJoiner);
          adapter.setPresenceInRoom(adapter, room);
          const timeout = 7e3;
          adapter._timeouts[`${room}_${newJoiner}`] = setInterval((adapter2, rooms, name) => {
            adapterLog.debug(`Timeout! Room: ${room}, User: ${name}, Now: ${Date.now()}, lastSeen: ${adapter2._presence[room].lastSeen}, Diff: ${Date.now() - adapter2._presence[room].lastSeen}`);
            if (Date.now() - adapter2._presence[room].lastSeen > timeout + 10) {
              adapter2.removeNameFromRoom(room, name);
              adapter2.setPresenceInRoom(adapter2, room);
            }
          }, 2e3, adapter, room, newJoiner);
        } else {
          adapterLog.warn(`Person in room (${room}) is unknown. Please add device with BTLE_ID[${device}] to the configuration.`);
        }
      } else {
        return;
      }
      adapterLog.debug(`New msg topic: ${newTopic}`);
      adapter.processMsg(adapter, newTopic, payload.toString());
    });
    client.on("error", function(error) {
      adapterLog.warn("MQTT server returned error: " + error);
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
  setup(adapter) {
    const objData = {
      type: "folder",
      common: {
        "name": "Presence folder",
        "read": true,
        "write": false,
        type: "object"
      },
      native: {}
    };
    adapter.createOrExtendObject(adapter, `presence`, objData, null);
  }
  async setPresenceInRoom(adapter, room) {
    await adapter.createOrExtendObject(adapter, `presence.${room}`, {
      type: "state",
      common: {
        "name": "",
        "read": true,
        "write": false,
        "role": "indicator",
        "type": "boolean"
      },
      native: {}
    }, adapter.getPresenceInRoom(room));
    await adapter.createOrExtendObject(adapter, `presence.${room}.people_in_room`, {
      type: "state",
      common: {
        "name": "",
        "read": true,
        "write": false,
        "role": "value",
        "type": "number"
      },
      native: {}
    }, adapter.getPeopleInRoom(room));
    await adapter.createOrExtendObject(adapter, `presence.${room}.names`, {
      type: "state",
      common: {
        "name": "",
        "read": true,
        "write": false,
        "role": "value",
        "type": "string"
      },
      native: {}
    }, adapter.getNamesInRoom(room));
  }
  getUserByBTLEID(adapterConfig, BTLE_ID) {
    for (let n = 0; n < adapterConfig.devices.length; n++) {
      if (adapterConfig.devices[n].BTLE_ID === BTLE_ID)
        return adapterConfig.devices[n].name;
    }
  }
  isNumber(str) {
    return !Number.isNaN(Number.parseFloat(str));
  }
  processObject(adapter, topic, objData, payload) {
    if (typeof payload === "undefined" || payload === null)
      return;
    adapter.createOrExtendObject(adapter, topic, objData, null);
    Object.keys(payload).forEach(function(key) {
      objData.type = "state";
      objData.common.role = `value`;
      objData.common.type = `${typeof payload[key]}`;
      adapter.createOrExtendObject(adapter, topic + `.${key}`, objData, payload[key]);
    });
  }
  processMsg(adapter, topic, payload) {
    if (typeof payload === "undefined" || payload === null)
      return;
    let value = payload;
    const objData = {
      type: "state",
      common: {
        "name": topic.split(".").pop() || "",
        "read": true,
        "write": false,
        "role": "value",
        "type": "string"
      },
      native: {}
    };
    if (topic.split(".").shift() === "devices") {
      objData.type = "folder";
      objData.common.role = "";
      adapter.processObject(adapter, topic, objData, JSON.parse(payload));
    }
    if (topic.split(".").pop() === "telemetry") {
      objData.type = "folder";
      objData.common.role = "";
      adapter.processObject(adapter, topic, objData, JSON.parse(payload));
    }
    if (adapter.isNumber(value)) {
      objData.common.type = "number";
      value = Number.parseFloat(value);
    }
    if (value === "NaN")
      value = null;
    adapter.createOrExtendObject(adapter, topic, objData, value);
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
