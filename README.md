![Logo](admin/espresence.svg)
# ioBroker.espresence

[![NPM version](https://img.shields.io/npm/v/iobroker.espresence.svg)](https://www.npmjs.com/package/iobroker.espresence)
[![Downloads](https://img.shields.io/npm/dm/iobroker.espresence.svg)](https://www.npmjs.com/package/iobroker.espresence)
![Number of Installations](https://iobroker.live/badges/espresence-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/espresence-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.espresence.png?downloads=true)](https://nodei.co/npm/iobroker.espresence/)

**Tests:** ![Test and Release](https://github.com/grizzelbee/ioBroker.espresence/workflows/Test%20and%20Release/badge.svg)

## ESPresence adapter for ioBroker

Presence detection on room level with ESP32

This projects implements an ioBroker adapter for the ESPresence project, which can be found [here](https://espresense.com/)
This project is currently (2022-09-01) in a pretty early state. 

## Prerequisites:
1. ESP32 devices flashed with ESPresense 
2. MQTT broker (server) like mosquitto, ioBroker.mqtt-adapter in server mode, or any other up and running 
3. ESP devices set up und connected to the mqtt broker


## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**


### v 0.1.0 (2022-09-07) (In the lap of the gods)
* (grizzelbee) initial release - first basically working version

## License
MIT License

Copyright (c) 2022 grizzelbee <open.source@hingsen.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.