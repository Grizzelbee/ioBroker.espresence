/*
 * Created with @iobroker/create-adapter v2.2.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as mqtt from 'mqtt';

// interfaces
interface Presence {
    room  : string,
    names : Array<string>;
    lastSeen : number;
}

class Espresence extends utils.Adapter {
    // class members
    _presence : Presence;
    _timeouts : object;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'espresence',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        // init
        this._presence = {};
        this._timeouts = {};
    }

    initRoom(room : string) : void {
        this._presence[room] = [];
    }

    getPeopleInRoom(room : string) : number {
        return this._presence[room].length;
    }

    getPresenceInRoom(room :  string) : boolean {
        return this._presence[room].length > 0;
    }

    getNamesInRoom(room : string) : string {
        return this._presence[room].join(',');
    }

    setNamesInRoom(room : string, newJoiner : string) : void {
        if (!this._presence[room].includes(newJoiner)){
            this._presence[room].push(newJoiner);
            Object.keys(this._presence).forEach( (key)=>{
                this.log.debug(`Testing whether ${newJoiner} is in room ${key}`);
                if (key != room){
                    if (this.isPersonInRoom(newJoiner, key)){
                        this.removeNameFromRoom(key , newJoiner);
                    }
                }
            })
        }
        this._presence[room].lastSeen = new Date();
    }

    isPersonInRoom(person: string, room : string) : boolean {
        return this._presence[room].includes(person);
    }

    removeNameFromRoom(room : string, name : string) : void {
        if (typeof this._presence[room] === 'undefined') return;
        const index = this._presence[room].indexOf(name);
        if (index > -1) { // only splice array when item is found
            this._presence[room].splice(index, 1); // 2nd parameter means remove one item only
        }
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        this.setup(this);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const adapter = this;
        const adapterLog = this.log;
        const adapterConfig = this.config;
        const options = {
            // Clean session
            clean: true,
            connectTimeout: 4000,
            protocolVersion: 3,
            protocolId: 'MQIsdp',
            // Auth
            clientId: 'ESPresence.' + this.instance,
            username: adapterConfig.user,
            password: adapterConfig.password,
        }
        adapterLog.warn(`Adapter configuration: ${JSON.stringify(adapterConfig)}`);
        // Initialize your adapter here
        adapterLog.info(`Connecting to MQTT broker [${adapterConfig.broker}:${adapterConfig.port}]`);
        const client = mqtt.connect(`mqtt://${adapterConfig.broker}:${adapterConfig.port}`, options);

        client.on('connect', function (connACK) {
            if (connACK.returnCode===0){
                adapterLog.info(`MQTT connection to broker [${adapterConfig.broker}:${adapterConfig.port}] established.`);
                // Subscribes to the status topic to receive updates
                client.subscribe('#', function(err, granted) {
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

        client.on('message', function (topic, payload) {
            adapterLog.debug(`MQTT topic [${topic}] received message: ${payload.toString()}`);
            const topicArray = topic.split('/');
            const baseTopic   = topicArray.shift();
            const level2Topic = topicArray.shift();
            const newTopic = topicArray.join('.');
            let   room = null;
            if (level2Topic === 'rooms') {
                const room = topicArray.shift();
                if (adapter._presence[room]) {
                    return;
                } else {
                    adapter.initRoom(room);
                    adapter.setPresenceInRoom(adapter, room);
                }
            }
            if (level2Topic === 'devices'){
                room = topicArray.pop();
                if (!adapter._presence[room]) return;
                const device    : string = topicArray.pop() || 'NoDevice';
                const newJoiner : string|undefined = adapter.getUserByBTLEID(adapterConfig, device);
                if (newJoiner && room) {
                    // adapterLog.debug(`Topic-Parts: Base-Topic: ${baseTopic}, New-Topic: ${newTopic}, Room: ${room}, Newjoiner: ${newJoiner}`);
                    clearInterval(adapter._timeouts[`${room}_${newJoiner}`]);
                    adapter.setNamesInRoom(room, newJoiner);
                    adapter.setPresenceInRoom(adapter, room);
                    const timeout : number = 7000;
                    adapter._timeouts[`${room}_${newJoiner}`] = setInterval((adapter: Espresence, rooms: string, name: string) => {
                        adapterLog.debug(`Timeout! Room: ${room}, User: ${name}, Now: ${Date.now()}, lastSeen: ${adapter._presence[room].lastSeen}, Diff: ${Date.now() - adapter._presence[room].lastSeen}`);
                        if ( (Date.now() - adapter._presence[room].lastSeen) > timeout+10 ){
                            adapter.removeNameFromRoom(room, name);
                            adapter.setPresenceInRoom(adapter, room);
                        }
                    }, 2000, adapter, room, newJoiner);
                } else{
                    adapterLog.warn(`Person in room (${room}) is unknown. Please add device with BTLE_ID[${device}] to the configuration.`);
                }
            } else {
                // adapterLog.debug(`Topic-Parts: Base-Topic: ${baseTopic}, New-Topic: ${newTopic}`);
                // if (baseTopic === 'homeassistant' || baseTopic === 'info') return;
                return;
            }
            adapterLog.debug(`New msg topic: ${newTopic}`);
            adapter.processMsg(adapter, newTopic, payload.toString() );
        });

        client.on('error', function (error) {
            adapterLog.warn('MQTT server returned error: ' + error);
        });

        client.on('reconnect', function () {
            adapterLog.info('Reconnecting to mqtt server.');
        });

        client.on('close', function () {
            adapterLog.info('Disconnected from mqtt server.');
        });

        client.on('offline', function () {
            adapterLog.info('MQTT offline.');
        });
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named 'testVariable'
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // You can also add a subscription for multiple states. The following line watches all states starting with 'lights.'
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

    }

    setup(adapter : Espresence) : void {
        const objData : ioBroker.SettableObject = {
            type: 'folder',
            common: {'name': 'Presence folder',
                'read': true,
                'write': false,
                type: 'object'
            },
            native: {}
        };
        adapter.createOrExtendObject(adapter, `presence`, objData, null);
    }

    async setPresenceInRoom(adapter : Espresence, room : string) : Promise<void> {
        await adapter.createOrExtendObject(adapter, `presence.${room}`, {
            type: 'state',
            common: {'name': '',
                'read': true,
                'write': false,
                'role': 'indicator',
                'type': 'boolean'
            },
            native: {}
        }, adapter.getPresenceInRoom(room));
        await adapter.createOrExtendObject(adapter, `presence.${room}.people_in_room`, {
            type: 'state',
            common: {'name': '',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number'
            },
            native: {}
        }, adapter.getPeopleInRoom(room));
        await adapter.createOrExtendObject(adapter, `presence.${room}.names`, {
            type: 'state',
            common: {'name': '',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'string'
            },
            native: {}
        }, adapter.getNamesInRoom(room));
    }

    getUserByBTLEID(adapterConfig : Espresence.AdapterConfig, BTLE_ID : string) : string|undefined{
        for (let n=0; n < adapterConfig.devices.length; n++){
            if (adapterConfig.devices[n].BTLE_ID === BTLE_ID)
                return adapterConfig.devices[n].name;
        }
    }

    isNumber(str : string): boolean {
        return !Number.isNaN( Number.parseFloat(str) );
    }

    processObject(adapter : Espresence, topic : string, objData : ioBroker.SettableObject, payload : object) : void{
        if (typeof payload === 'undefined' || payload === null) return;
        adapter.createOrExtendObject(adapter, topic, objData, null);
        Object.keys(payload).forEach(function(key) {
            objData.type = 'state';
            objData.common.role = `value`;
            objData.common.type = `${typeof payload[key]}`;
            adapter.createOrExtendObject(adapter, topic + `.${key}`, objData, payload[key]);
        })
    }

    processMsg(adapter : Espresence, topic : string, payload : string) : void{
        if (typeof payload === 'undefined' || payload === null) return;
        let value : any = payload;
        const objData : ioBroker.SettableObject = {
            type: 'state',
            common: {'name': topic.split('.').pop() || '',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'string'
            },
            native: {}
        };

        if (topic.split('.').shift() === 'devices'){
            objData.type = 'folder';
            objData.common.role='';
            adapter.processObject(adapter, topic, objData, JSON.parse(payload) );
        }

        if (topic.split('.').pop() === 'telemetry'){
            objData.type = 'folder';
            objData.common.role='';
            adapter.processObject(adapter, topic, objData, JSON.parse(payload) );
        }

        if ( adapter.isNumber(value) ){
            objData.common.type='number';
            value = Number.parseFloat(value);
        }
        if (value==='NaN') value=null;

        adapter.createOrExtendObject(adapter, topic, objData, value);
    }




    /**
     * Function Create or extend object
     *
     * Updates an existing object (id) or creates it if not existing.
     * In case id and name are equal, it will only set it's new state
     *
     * @param {object} adapter link to the adapters instance
     * @param {string} id path/id of datapoint to create
     * @param {object} objData details to the datapoint to be created (Device, channel, state, ...)
     * @param {any} value value of the datapoint
     */
    createOrExtendObject(adapter : Espresence, id : string, objData : ioBroker.SettableObject, value : any) : void{
        adapter.getObject(id, function (err, oldObj) {
            if (!err && oldObj) {
                if ( objData.name === oldObj.common.name ){
                    adapter.setState(id, value, true);
                } else{
                    adapter.extendObject(id, objData, () => {adapter.setState(id, value, true);});
                }
            } else {
                adapter.setObjectNotExists(id, objData, () => {adapter.setState(id, value, true);});
            }
        });
    }


    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires 'common.messagebox' property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Espresence(options);
} else {
    // otherwise start the instance directly
    (() => new Espresence())();
}