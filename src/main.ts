/*
 * Created with @iobroker/create-adapter v2.2.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as mqtt from 'mqtt';


// Load your modules here, e.g.:
// import * as fs from 'fs';

class Espresence extends utils.Adapter {
/*
* Brainstorming:
* A mqtt broker is needed for the ESPs to connect to -> setup ioBroker.MQTT-adapter as mqtt-Broker (Server)
* A mqtt client is needed to connect against the broker to receive the messages of the ESPs-> ESPresence adapter must connect against MQTT-Adapter
* */
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
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
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
        // Initialize your adapter here
        adapterLog.info(`Connecting to MQTT broker [${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}], user:[${adapterConfig.user}], password:[***]`);
        const client = mqtt.connect(`mqtt://${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}`, options);

        client.on('connect', function (connACK) {
            if (connACK.returnCode===0){
                adapterLog.info(`MQTT connection to broker [${adapterConfig.mqttBroker}:${adapterConfig.mqttPort}] established.`);
                // Subscribes to the status topic to receive updates
                client.subscribe('/#', function (err) {
                    if (!err){
                        adapterLog.info(`Subscribed to all topics.`);
                    } else {
                        adapterLog.info(`Error during subscription: ${JSON.stringify(err)}`);
                    }
                });
            } else {
                adapterLog.info(`Error during connect: ${JSON.stringify(connACK)}`);
            }
        });

        client.on('message', function (topic, payload) {
            adapterLog.debug(`MQTT topic [${topic}] received message: ${payload.toString()}`);
            adapter.processMsg(adapter, topic, payload);
        });

        client.on('error', function (error) {
            adapterLog.debug('MQTT server returned error: ' + error);
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

    isJsonString(str : string): boolean {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    isNumber(str : string): boolean {
        return !Number.isNaN( Number.parseFloat(str) );
    }

    processMsg(adapter : object, topic : string, payload : Buffer){
        let value = payload.toString();
        const objData = {
            type: 'state',
            common: {'name': topic.split('/').pop(),
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'string'
            },
            native: {}
        };
        if ( adapter.isJsonString(value) ) {
            const jPayload = JSON.parse(value);
            objData.type = 'folder';
            objData.role='';
            adapter.processMsg(adapter, topic, objData, jPayload)
        }
        if ( adapter.isNumber(value) ){
            objData.type='number';
            value = Number.parseFloat(value);
        }


        adapter.createOrExtendObject(adapter, topic.split('/').join('.'), objData, value)
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
    createOrExtendObject(adapter, id, objData, value) {
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