const Discord = require('discord.js');
const myIntents = new Discord.Intents();
myIntents.add(Discord.Intents.FLAGS.GUILDS,
              Discord.Intents.FLAGS.GUILD_MEMBERS,
              Discord.Intents.FLAGS.GUILD_MESSAGES,
              Discord.Intents.FLAGS.DIRECT_MESSAGES);
const bot = new Discord.Client({ intents: myIntents });
const request = require('request');
const path = require('path');
const args = process.argv.splice(2);
const configPath = args.length > 0
    ? path.resolve(__dirname, args[0])
    : './RDMMonitorConfig.json';
const config = require(configPath);
const warningImage = "https://raw.githubusercontent.com/Kneckter/RDMMonitor/master/static/warned.png";
const okImage = "https://raw.githubusercontent.com/Kneckter/RDMMonitor/master/static/ok.png";
const offlineImage = "https://raw.githubusercontent.com/Kneckter/RDMMonitor/master/static/offline.png";
const warningTime = config.warningTime * 60000;
const offlineTime = config.offlineTime * 60000;
const reopenTime = config.reopenTime * 60000;
const rebootTime = config.rebootAgainTimer * 60000;
const reapplySAMTime = config.reapplySAMTime * 60000;
const okColor = 0x008000;
const warningColor = 0xFFFF00;
const offlineColor = 0xFF0000;
const DEVICE_QUERY = 'api/status';
var postingDelay = config.postingDelay * 60000;
var devices = {};
var okDeviceMessage = "";
var warnDeviceMessage = "";
var offlineDeviceMessage = "";
var lastUpdatedMessage = "";
var channelsCleared = false;

Login();

function Login() {
    let version = Discord.version;
    version = version.split('.');
    let primaryVersion = Number(version[0]);
    if(primaryVersion < 13) {
        console.log(GetTimestamp() + "FATAL ERROR: discord.js version must be 13.0 or newer, you are using: " + Discord.version);
        console.log(GetTimestamp() + "Bot will not continue at this point, please upgrade discord.js, also requires node version 16 or newer");
    }
    else {
        console.log(GetTimestamp() + "Logging in Discord bot token");
        bot.login(config.token);
    }
}

bot.on('messageCreate', async message => {
    // MAKE SURE ITS A COMMAND
    if(!message.content.startsWith(config.cmdPrefix)) {
        return;
    }
    //STOP SCRIPT IF DM/PM
    if(message.channel.type == "DM") {
        return;
    }
    // GET CHANNEL INFO
    let guild = message.guild;
    let channel = message.channel.id;
    let member = message.member;
    let msg = message.content;
    // REMOVE LETTER CASE (MAKE ALL LOWERCASE)
    let command = msg.toLowerCase();
    command = command.split(" ")[0];
    command = command.slice(config.cmdPrefix.length);
    // GET ARGUMENTS
    let args = msg.slice(config.cmdPrefix.length + command.length); // Cut the command off
    args = args.split(",").map(function(item) {
        return item.trim();
    });
    // GET ROLES FROM CONFIG
    let AdminR = guild.roles.cache.find(role => role.name === config.adminRoleName);
    if(!AdminR) {
        AdminR = { "id": "111111111111111111" };
        console.info(GetTimestamp() + "[ERROR] [CONFIG] I could not find admin role: " + config.adminRoleName);
    }
    //STOP SCRIPT IF IT IS NOT THE MAIN CHANNEL
    if (config.channel != channel) {
        return;
    }
    // ############################# COMMANDS/HELP ################################
    if(member.roles.cache.has(AdminR.id)) {
        if(command === "help") {
            message.delete();
            cmds = "`" + config.cmdPrefix + "restart`   \\\u00BB   to manually restart the whole bot.\n" +
                "`" + config.cmdPrefix + "reopen <DEVICE-NAMES>`   \\\u00BB   to reopen the game on specific devices.\n" +
                "`" + config.cmdPrefix + "reboot <DEVICE-NAMES>`   \\\u00BB   to reboot the specific devices.\n" +
                "`" + config.cmdPrefix + "sam <DEVICE-NAMES>`   \\\u00BB   to reapply the SAM profile to the specific devices\n" +
                "`" + config.cmdPrefix + "brightness <VALUE>, <DEVICE-NAMES>`   \\\u00BB   to change the brightness on the specific devices\n" +
                "The commands with `<DEVICE-NAMES>` accept multiple names separated by commas.\n" +
                "They can be used to skip the exclusion list if you specify a name on the list.\n" +
                "They can accept `all`, `allwarn`, or `alloff` to apply to groups but will omit devices on the exclude lists."
            bot.channels.cache.get(config.channel).send(cmds).then((message) => {
                setTimeout(() => message.delete(), 10000);
            }).catch(err => {console.error(GetTimestamp()+err);});
            return;
        }
        if(command === "restart") {
            // Restart the whole bot
            if(!args[0]) {
                await bot.channels.cache.get(config.channel).send("Restarting the bot...");
                RestartBot('manual');
            }
            else {
                message.delete();
                message.reply("If you send this command again without any arguements, it will restart the bot. Did you mean to reboot a devices like `" + config.cmdPrefix + "reboot 001-SE`?");
                return;
            }
        }

        if(!args[0]) {
            message.delete();
            message.reply("Please enter a device name after the command like `" + config.cmdPrefix + "reboot 001-SE`");
            return;
        }
        if(command === "brightness") {
            let temp = parseInt(args[0]);
            if (temp >= 0 && temp <= 100) {
                var brightInt = temp;
            }
            else {
                message.delete();
                message.reply("Please enter a number for brightness between 0-100% after the command like `" + config.cmdPrefix + "brightness 0, 001-SE`");
                return;
            }
            if(!args[1]) {
                message.delete();
                message.reply("Please enter a device name after the brightness value like `" + config.cmdPrefix + "brightness 0, 001-SE`");
                return;
            }
        }

        // Handle all/alloff/allwarn variables and omit exclusions
        var manDevices = [];
        var exclude = [];
        if(command === "reboot") {
            exclude = config.excludeFromReboots;
        }
        else if(command === "reopen") {
            exclude = config.excludeFromReopen;
        }
        else if(command === "sam") {
            exclude = config.excludeFromReapplySAM;
        }

        if (args[0] == "all" || args[1] == "all") {
            for(var deviceName in devices) {
                let device = devices[deviceName];
                if(!exclude.includes(deviceName.slice(0, -4))) {
                    manDevices.push(device.name);
                }
            }
        }
        else if (args[0] == "alloff" || args[1] == "alloff") {
            let now = new Date();
            now = now.getTime();
            for(let deviceName in devices) {
                let device = devices[deviceName];
                let lastSeen = new Date(0);
                lastSeen.setUTCSeconds(device.lastSeen);
                lastSeen = lastSeen.getTime();
                lastSeen = now - lastSeen;
                if(lastSeen > offlineTime && !exclude.includes(deviceName.slice(0, -4))) {
                    manDevices.push(device.name);
                }
            }
        }
        else if (args[0] == "allwarn" || args[1] == "allwarn") {
            let now = new Date();
            now = now.getTime();
            for(let deviceName in devices) {
                let device = devices[deviceName];
                let lastSeen = new Date(0);
                lastSeen.setUTCSeconds(device.lastSeen);
                lastSeen = lastSeen.getTime();
                lastSeen = now - lastSeen;
                if(lastSeen > warningTime && !exclude.includes(deviceName.slice(0, -4))) {
                    manDevices.push(device.name);
                }
            }
        }
        else {
            // Check all the device names and add them to the array
            if(command === "brightness") {
                var x = 1;
            }
            else {
                var x = 0;
            }
            for(x; x < args.length; x++) {
                if (devices[args[x]]) {
                    manDevices.push(args[x]);
                }
                else {
                    bot.channels.cache.get(config.channel).send("Could not locate device: " + args[x]);
                }
            }
        }

        if(command === "reboot") {
            // Reboot a specific device
            RebootWarnDevice(manDevices);
        }
        else if(command === "reopen") {
            // Reopen a game for a specific device
            ReopenWarnGame(manDevices);
        }
        else if(command === "sam") {
            // Reapply the SAM profile
            ReapplySAM(manDevices);
        }
        else if(command === "brightness") {
            // Change the brightness on the device
            ChangeBrightness(manDevices, brightInt);
        }
    }
    else {
        message.reply("You are **NOT** allowed to use this command! \ntry using: `" + config.cmdPrefix + "commands`").then((message) => {
            setTimeout(() => message.delete(), 10000);
        }).catch(err => {console.error(GetTimestamp()+err);});
        return;
    }
});

bot.on('ready', () => {
    console.log(GetTimestamp() + "Discord bot logged in and ready");
    if(config.warningTime > 1000 || config.offlineTime > 1000) {
        console.log(GetTimestamp() + "WARNING warningTime and offlineTime should be in MINUTES not milliseconds");
    }
    if(isNaN(postingDelay)) {
        postingDelay = 0;
    }
    StartupSequence();
    return;
});

bot.on('error', function(err) {
    if(typeof err == 'object') {
        err = JSON.stringify(err);
    }
    console.error(GetTimestamp() + 'Bot error: ' + err);
    RestartBot();
    return;
});

bot.on('disconnect', function(closed) {
    console.error(GetTimestamp() + 'Disconnected from Discord');
    return;
});

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function StartupSequence() {
    await ClearAllChannels();
    await UpdateStatusLoop();
    await PostStatus();
}

async function UpdateStatusLoop() {
    console.log(GetTimestamp() + "Beginning device query");
    await UpdateDevices();
    console.log(GetTimestamp() + "Finished device query");
    setTimeout(UpdateStatusLoop, 5000);
}

function UpdateDevices() {
    return new Promise(function(resolve) {
        if(!config.postDeviceSummary) {
            return resolve(true);
        }
        request.get(config.rotomURL + DEVICE_QUERY, (err, res, body) => {
            if(err) {
                console.error(GetTimestamp() + "Error querying Rotom: " + err.code);
                return resolve();
            }
            let data;
            try {
                data = JSON.parse(body);
            }
            catch (err) {
                console.error(GetTimestamp() + "Error parsing the body: " + err);
                return resolve();
            }
            if(!data.workers) {
                console.error(GetTimestamp() + "Failed to retrieve worker data from the website");
                return resolve();
            }
            data.workers.forEach(async function(worker) {
                if(!devices[worker.mitm.origin + worker.mitm.workerId.slice(-4)]) {
                    await AddDevice(worker);
                }
                else {
                    await UpdateDevice(worker);
                }
            });
            return resolve();
        });
    });
}

function AddDevice(device) {
    let name = device.mitm.origin + device.mitm.workerId.slice(-4);
    if(config.ignoredDevices.length > 0) {
        if(config.ignoredDevices.indexOf(name.slice(-4)) != -1) {
            return;
        }
    }
    devices[name] = {
        "name": name,
        "lastSeen": device.mitm.dateLastMessageReceived / 1000,
        "alerted": false,
        "rebooted": false,
        "reopened": false,
        "reapplied": false,
        "rebooted_time": 0,
        "retry_reboot": false,
        "reboots": 0
    };
    if(!devices[name].lastSeen) {
        devices[name].lastSeen = "Never"
    }
    return;
}

function UpdateDevice(device) {
    let name = device.mitm.origin + device.mitm.workerId.slice(-4);
    if(!devices[name]) {
        return AddDevice(device);
    }
    else {
        devices[name].lastSeen = device.mitm.dateLastMessageReceived / 1000;
    }
    if(!devices[name].lastSeen) {
        devices[name].lastSeen = "Never"
    }
    return;
}

async function PostStatus() {
    await PostGroupedDevices();
    await SendOfflineDeviceDMs();
    await ReopenWarnGame();
    await ReapplySAM();
    await RebootWarnDevice();
}

async function PostGroupedDevices() {
    return new Promise(async function(resolve) {
        if(config.postDeviceSummary) {
            console.log(GetTimestamp() + "Posting device summary");
            let now = new Date();
            now = now.getTime();
            let okDevices = [];
            let warnDevices = [];
            let offlineDevices = [];
            let okDevicesCount = 0;
            let warnDevicesCount = 0;
            let offlineDevicesCount = 0;
            for(let deviceName in devices) {
                let device = devices[deviceName];
                let lastSeen = new Date(0);
                lastSeen.setUTCSeconds(device.lastSeen);
                lastSeen = lastSeen.getTime();
                lastSeen = now - lastSeen;
                console.log(lastSeen);
                if(lastSeen > offlineTime) {
                    offlineDevices.push(device.name);
                }
                else if(lastSeen > warningTime) {
                    warnDevices.push(device.name);
                }
                else {
                    okDevices.push(device.name);
                }
            }
            okDevicesCount = okDevices.length;
            warnDevicesCount = warnDevices.length;
            offlineDevicesCount = offlineDevices.length;
            if(okDevices.length == 0) {
                okDevices.push("None")
            }
            if(warnDevices.length == 0) {
                warnDevices.push("None")
            }
            if(offlineDevices.length == 0) {
                offlineDevices.push("None")
            }
            PostDeviceGroup(okDevices.sort(), okColor, okImage, 'Working Devices: ' + okDevicesCount, okDeviceMessage).then(posted => {
                okDeviceMessage = posted.id;
                PostDeviceGroup(warnDevices.sort(), warningColor, warningImage, 'Warned Devices: ' + warnDevicesCount, warnDeviceMessage).then(posted => {
                    warnDeviceMessage = posted.id;
                    PostDeviceGroup(offlineDevices.sort(), offlineColor, offlineImage, 'Offline Devices: ' + offlineDevicesCount, offlineDeviceMessage).then(posted => {
                        offlineDeviceMessage = posted.id;
                        offlineDeviceList = offlineDevices;
                        PostLastUpdated();
                        console.log(GetTimestamp() + "Finished posting device summary");
                        setTimeout(PostGroupedDevices, postingDelay);
                        return resolve();
                    });
                });
            });
        }
        else {
            return resolve();
        }
    });
}

function SendOfflineDeviceDMs() {
    let now = new Date();
    now = now.getTime();
    let offlineDevices = [];
    for(let deviceName in devices) {
        let device = devices[deviceName];
        let lastSeen = new Date(0);
        lastSeen.setUTCSeconds(device.lastSeen);
        lastSeen = lastSeen.getTime();
        lastSeen = now - lastSeen;
        if(lastSeen > offlineTime) {
            offlineDevices.push(device.name);
        }
    }
    for(let i = 0; i < offlineDevices.length; i++) {
        if(!devices[offlineDevices[i]].alerted) {
            SendDMAlert(offlineDevices[i]);
            devices[offlineDevices[i]].alerted = true;
        }
    }
    for(let deviceName in devices) {
        if(devices[deviceName].alerted && offlineDevices.indexOf(deviceName) == -1) {
            devices[deviceName].alerted = false;
            SendDeviceOnlineAlert(deviceName.name);
        }
    }
    setTimeout(SendOfflineDeviceDMs, 60000);
}

function ReopenWarnGame(manDevices) {
    if(!config.allowReopenGame && !manDevices) {
        return;
    }
    let now = new Date();
    now = now.getTime();
    let reopenDevices = [];
    if (manDevices) {
        reopenDevices = manDevices;
    }
    else {
        for(var deviceName in devices) {
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;
            if(lastSeen > reopenTime && lastSeen < reapplySAMTime) {
                if(!config.excludeFromReopen.includes(deviceName.name.slice(0, -4))) {
                    reopenDevices.push(deviceName);
                }
            }
        }
    }
    for(var i = 0; i < reopenDevices.length; i++) {
        if(!devices[reopenDevices[i]].reopened || manDevices) {
            for(var ii = 0; ii < config.reopenMonitorURL.length; ii++) {
                const options = {
                    url: config.reopenMonitorURL[ii],
                    json: true,
                    method: 'POST',
                    body: {
                        'type': 'reopen',
                        'device': devices[reopenDevices[i]].name.slice(0, -4)
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                };
                console.info(GetTimestamp() + `Sending reopen game request for ${devices[reopenDevices[i]].name} to remote listener ${config.reopenMonitorURL[ii]}`);
                if (manDevices) { bot.channels.cache.get(config.channel).send(`Sending reopen game request for ${devices[reopenDevices[i]].name} to remote listener`); }
                request(options, (err, res, body) => {
                    if(err) {
                        console.error(GetTimestamp() + `Failed to send reopen game request to remote listener for ${options.body.device}`);
                        if (manDevices) { bot.channels.cache.get(config.channel).send(`Failed to send reopen game request to remote listener for ${options.body.device}`); }
                    }
                });
                devices[reopenDevices[i]].reopened = true;
            }
        }
    }
    for(var deviceName in devices) {
        if(devices[deviceName].reopened && reopenDevices.indexOf(deviceName) == -1) {
            devices[deviceName].reopened = false;
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;
            if(lastSeen < reopenTime) {
                console.info(GetTimestamp() + `Device ${devices[deviceName].name} has come back online from reopening the game`);
            }
        }
    }
    setTimeout(ReopenWarnGame, 60000);
}

function ReapplySAM(manDevices) {
    if(!config.allowReapplySAM && !manDevices) {
        return;
    }
    let now = new Date();
    now = now.getTime();
    let reapplyDevices = [];
    if (manDevices) {
        reapplyDevices = manDevices;
    }
    else {
        for(var deviceName in devices) {
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;
            if(lastSeen > reapplySAMTime && lastSeen < warningTime) {
                if(!config.excludeFromReapplySAM.includes(deviceName.name.slice(0, -4))) {
                    reapplyDevices.push(deviceName);
                }
            }
        }
    }
    for(var i = 0; i < reapplyDevices.length; i++) {
        if(!devices[reapplyDevices[i]].reapplied || manDevices) {
            for(var ii = 0; ii < config.reapplySAMMonitorURL.length; ii++) {
                const options = {
                    url: config.reapplySAMMonitorURL[ii],
                    json: true,
                    method: 'POST',
                    body: {
                        'type': 'profile',
                        'device': devices[reapplyDevices[i]].name.slice(0, -4)
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                };
                console.info(GetTimestamp() + `Sending a request to reapply the SAM profile for ${devices[reapplyDevices[i]].name} to remote listener ${config.reapplySAMMonitorURL[ii]}`);
                if (manDevices) { bot.channels.cache.get(config.channel).send(`Sending a request to reapply the SAM profile for ${devices[reapplyDevices[i]].name} to remote listener`); }
                request(options, (err, res, body) => {
                    if(err) {
                        console.error(GetTimestamp() + `Failed to send request to reapply the SAM profile to remote listener for ${options.body.device}`);
                        if (manDevices) { bot.channels.cache.get(config.channel).send(`Failed to send request to reapply the SAM profile to remote listener for ${options.body.device}`); }
                    }
                });
                devices[reapplyDevices[i]].reapplied = true;
            }
        }
    }
    for(var deviceName in devices) {
        if(devices[deviceName].reopened && reapplyDevices.indexOf(deviceName) != -1) {
            // Remove the reopen tracker since it is out of that timeframe now.
            devices[deviceName].reopened = false;
        }
        if(devices[deviceName].reapplied && reapplyDevices.indexOf(deviceName) == -1) {
            devices[deviceName].reapplied = false;
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;
            if(lastSeen < reapplySAMTime) {
                console.info(GetTimestamp() + `Device ${devices[deviceName].name} has come back online from reapplying the profile`);
            }
        }
    }
    setTimeout(ReapplySAM, 60000);
}

function RebootWarnDevice(manDevices) {
    if(!config.allowWarnReboots && !manDevices) {
        return;
    }
    let now = new Date();
    now = now.getTime();
    let warnedDevices = [];
    if (manDevices) {
        warnedDevices = manDevices;
    }
    else {
        for(var deviceName in devices) {
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;
            if(lastSeen > warningTime) {
                if(!config.excludeFromReboots.includes(deviceName.name.slice(0, -4))) {
                    warnedDevices.push(deviceName);
                    if(devices[deviceName].rebooted && devices[deviceName].reboots < config.maxRebootRetries && Date.now() - devices[deviceName].rebooted_time > rebootTime ) {
                        devices[deviceName].retry_reboot = true;
                    }
                }
            }
        }
    }
    for(var i = 0; i < warnedDevices.length; i++) {
        if(!devices[warnedDevices[i]].rebooted || manDevices || devices[warnedDevices[i]].retry_reboot) {
            for(var ii = 0; ii < config.rebootMonitorURL.length; ii++) {
                const options = {
                    url: config.rebootMonitorURL[ii],
                    json: true,
                    method: 'POST',
                    body: {
                        'type': 'restart',
                        'device': devices[warnedDevices[i]].name.slice(0, -4)
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                };
                console.info(GetTimestamp() + `Sending reboot request for ${devices[warnedDevices[i]].name} to remote listener ${config.rebootMonitorURL[ii]}`);
                if (manDevices) { bot.channels.cache.get(config.channel).send(`Sending reboot request for ${devices[warnedDevices[i]].name} to remote listener`); }
                request(options, (err, res, body) => {
                    if(err) {
                        console.error(GetTimestamp() + `Failed to send reboot request to remote listener for ${options.body.device}`);
                        if (manDevices) { bot.channels.cache.get(config.channel).send(`Failed to send reboot request to remote listener for ${options.body.device}`); }
                    }
                });
                SendRebootAlert(warnedDevices[i].name);
                devices[warnedDevices[i]].rebooted = true;
                devices[warnedDevices[i]].rebooted_time = Date.now();
                devices[warnedDevices[i]].retry_reboot = false;
                devices[warnedDevices[i]].reboots = devices[warnedDevices[i]].reboots + 1;
            }
        }
    }
    if (!manDevices) { // Only remove tracking if this wasn't a manual request
        for(var deviceName in devices) {
            if(devices[deviceName].reopened && warnedDevices.indexOf(deviceName) != -1) {
                // Remove the reopen tracker since it is out of that timeframe now.
                devices[deviceName].reopened = false;
            }
            if(devices[deviceName].reapplied && warnedDevices.indexOf(deviceName) != -1) {
                // Remove the sam tracker since it is out of that timeframe now.
                devices[deviceName].reapplied = false;
            }
            if(devices[deviceName].rebooted && warnedDevices.indexOf(deviceName) == -1) {
                devices[deviceName].rebooted = false;
                devices[deviceName].rebooted_time = 0;
                devices[deviceName].retry_reboot = false;
                devices[deviceName].reboots = 0;
                console.info(GetTimestamp() + `Device ${devices[deviceName].name} has come back online from rebooting the device`);
            }
        }
    }
    setTimeout(RebootWarnDevice, 60000);
}

function ChangeBrightness(manDevices, brightInt) {
    for(var i = 0; i < manDevices.length; i++) {
        for(var ii = 0; ii < config.brightnessMonitorURL.length; ii++) {
            const options = {
                url: config.brightnessMonitorURL[ii],
                json: true,
                method: 'POST',
                body: {
                    'type': 'brightness',
                    'device': devices[manDevices[i]].name.slice(0, -4),
                    'value': brightInt
                },
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            };
            console.info(GetTimestamp() + `Sending a brightness change request for ${devices[manDevices[i]].name} to remote listener ${config.brightnessMonitorURL[ii]}. New brightness will be ${brightInt}%`);
            bot.channels.cache.get(config.channel).send(`Sending a brightness change request for ${devices[manDevices[i]].name} to remote listener. New brightness will be ${brightInt}%`);
            request(options, (err, res, body) => {
                if(err) {
                    console.error(GetTimestamp() + `Failed to send the brightness change request to remote listener for ${options.body.device}`);
                    bot.channels.cache.get(config.channel).send(`Failed to send the brightness change request to remote listener for ${options.body.device}`);
                }
            });
        }
    }
}

async function SendDMAlert(device) {
    for(let i = 0; i < config.userAlerts.length; i++) {
        let user = await bot.users.fetch(config.userAlerts[i]);
        if(!user) {
            console.error(GetTimestamp() + "Cannot find a user to DM with ID: " + config.userAlerts[i]);
        }
        else {
            user.send(GetTimestamp() + " Device: " + device + " is offline!").catch(error => {
                console.error(GetTimestamp() + "Failed to send a DM to user: " + user.id);
                return;
            });
        }
    }
}

async function SendRebootAlert(device) {
    if(!config.sendRebootAlerts) {
        return;
    }
    for(var i = 0; i < config.userAlerts.length; i++) {
        let user = await bot.users.fetch(config.userAlerts[i]);
        if(!user) {
            console.error(GetTimestamp() + "Cannot find a user to DM with ID: " + config.userAlerts[i]);
        }
        else {
            user.send(GetTimestamp() + " Device: " + device + " was sent the reboot command").catch(error => {
                console.error(GetTimestamp() + "Failed to send a DM to user: " + user.id);
                return;
            });
        }
    }
}

async function SendDeviceOnlineAlert(device) {
    for(let i = 0; i < config.userAlerts.length; i++) {
        let user = await bot.users.fetch(config.userAlerts[i]);
        if(!user) {
            console.error(GetTimestamp() + "Cannot find a user to DM with ID: " + config.userAlerts[i]);
        }
        else {
            user.send(GetTimestamp() + " Device: " + device + " has come back online").catch(error => {
                console.error(GetTimestamp() + "Failed to send a DM to user: " + user.id);
            });
        }
    }
}

function PostDeviceGroup(deviceList, color, image, title, messageID) {
    return new Promise(async function(resolve) {
        let channel = config.deviceSummaryChannel ? config.deviceSummaryChannel : config.channel;
        channel = await bot.channels.fetch(channel);
        let deviceString = GetDeviceString(deviceList);
        let embed = new Discord.MessageEmbed();
        embed.setTitle(title);
        embed.setColor(color);
        embed.setThumbnail(image);
        embed.setDescription(deviceString);
        if(messageID) {
            let message = await channel.messages.fetch(messageID);
            if(!message) {
                console.error(GetTimestamp() + "Missing device summary message");
                return resolve();
            }
            message.edit({
                embeds: [embed]
            }).then(posted => {
                return resolve(posted);
            }).catch(error => {
                console.error(GetTimestamp() + "Failed to edit a post: " + error);
                return resolve();
            });
        }
        else {
            channel.send({
                embeds: [embed]
            }).then(posted => {
                return resolve(posted);
            }).catch(err => {
                console.error(GetTimestamp() + "Error sending a message: " + err);
                return resolve();
            });
        }
    });
}

function GetDeviceString(deviceList) {
    let currentString = "";
    for(let i = 0; i < deviceList.length; i++) {
        if(currentString.length + deviceList[i].length + 2 > 2000) {
            return currentString + "and more...";
        }
        if(i == deviceList.length - 1) {
            currentString = currentString + deviceList[i];
        }
        else {
            currentString = currentString + deviceList[i] + ", ";
        }
    }
    return currentString;
}

async function PostLastUpdated() {
    let channel = config.deviceSummaryChannel ? config.deviceSummaryChannel : config.channel;
    channel = await bot.channels.fetch(channel);
    let now = new Date();
    let lastUpdated = "Last Updated at: **" + now.toLocaleString() + "**";
    if(lastUpdatedMessage) {
        let message = await channel.messages.fetch(lastUpdatedMessage);
        if(!message) {
            return;
        }
        message.edit(lastUpdated).then(edited => {
            lastUpdatedMessage = edited.id;
            return;
        }).catch(error => {
            console.log(GetTimestamp() + "Failed to edit a post: " + error);
            return;
        });
    }
    else {
        channel.send(lastUpdated).then(message => {
            lastUpdatedMessage = message.id;
            return;
        }).catch(err => {
            console.error(GetTimestamp() + "Error sending a message: " + err);
            return;
        });
    }
}

function ClearAllChannels() {
    return new Promise(function(resolve) {
        if(!config.clearMessagesOnStartup || channelsCleared) {
            return resolve();
        }
        let cleared = [];
        if(config.channel) {
            cleared.push(ClearMessages(config.channel));
            console.log(GetTimestamp() + "Clearing channel ID: " + config.channel);
        }
        if(config.deviceSummaryChannel) {
            cleared.push(ClearMessages(config.deviceSummaryChannel));
            console.log(GetTimestamp() + "Clearing channel ID: " + config.deviceSummaryChannel);
        }
        Promise.all(cleared).then(done => {
            channelsCleared = true;
            console.log(GetTimestamp() + "All channels cleared");
            return resolve();
        });
    });
}

function ClearMessages(channelID) {
    return new Promise(async function(resolve) {
        if(channelsCleared) {
            return resolve();
        }
        let channel = await bot.channels.fetch(channelID);
        if(!channel) {
            console.error(GetTimestamp() + "Could not find a channel with ID: " + channelID);
            return resolve();
        }
        let messages = await channel.bulkDelete(100, true);
        if(messages.size > 0) {
            await ClearMessages(channelID);
            return resolve(true);
        }
        else {
            console.log("Finished clearing channel ID: " + channelID);
            return resolve(true);
        }
    });
}

function GetTimestamp() {
    let now = new Date();
    return "[" + now.toLocaleString() + "]";
}

async function RestartBot(type) {
    if(type == 'manual') {
        process.exit(1);
    }
    else {
        console.error(GetTimestamp() + "Unexpected error, bot exiting in 1 minute");
        await sleep(60000);
        process.exit(1);
    }
}

process.on('uncaughtException', err => {
    if(typeof err == 'object') {
        err = JSON.stringify(err);
    }
    console.error(GetTimestamp() + 'Uncaught exception: ' + err);
    RestartBot();
});

process.on('unhandledRejection', (reason, p) => {
    console.error(GetTimestamp() + 'Unhandled Rejection: ' + reason);
    console.error(p);
    RestartBot();
});
