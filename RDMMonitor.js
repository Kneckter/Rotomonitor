const Discord=require('discord.js');
const bot=new Discord.Client();
const request = require('request');
const config = require('./RDMMonitorConfig.json');

const warningImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/warning.png";
const okImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/green.png";
const offlineImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/noPhone.png";

const warningTime = config.warningTime;
const offlineTime = config.offlineTime;

const okColor = 0x008000;
const warningColor = 0xFFFF00;
const offlineColor = 0xFF0000;


var devices = {};
var instances = {};
var okDeviceMessage = "";
var warnDeviceMessage = "";
var offlineDeviceMessage = "";
var lastUpdatedMessage = "";
var cleared = false;



bot.login(config.token);

bot.on('ready', () => {
   
    ClearMessages().then(result => {      
            PostStatus();        
    });
});

function UpdateInstances()
{
    return new Promise(function(resolve) {
        request.get(config.url+'api/get_data?show_instances=true', {'auth': {'user':config.websiteLogin, 'password':config.websitePassword}}, (err, res, body) => {
        
            let data = JSON.parse(body);

            if(data.status=="error" || !data.data)
            {
                console.log("Could not retrieve data from website: "+data.error);
                resolve(false);
                return;
            }
            
            if(!data.data.instances)
            {
                console.log("Failed to retrieve instance data from the website");
                resolve(false);
                return;
            }
            
            data.data.instances.forEach(function(instance) {
                if(!instances[instance.name])
                {
                    AddInstance(instance);
                }
                else
                {
                    UpdateInstance(instance);
                }
            });
            resolve(true);
        });
    });
}

function AddInstance(instance)
{
    if(config.ignoredInstances.indexOf(instance.name) != -1) { return }
    switch(instance.type)
    {
        case "Auto Quest":
        if(instance.status.bootstrapping)
        {
            let percent = instance.status.bootstrapping.current_count / instance.status.bootstrapping.total_count;
            percent *= 100;
            percent = PrecisionRound(percent, 2);

            instances[instance.name] = {
                'name':instance.name,
                'status':'Boostrapping: '+instance.status.bootstrapping.current_count+'/'+instance.status.bootstrapping.total_count+'('+percent+'%)'
            }
        }
        else
        {
            let percent = instance.status.quests.current_count_db / instance.status.quests.total_count;
            percent *= 100;
            percent = PrecisionRound(percent, 2);

            instances[instance.name] = {
                'name':instance.name,
                'status':instance.status.quests.current_count_db+'/'+instance.status.quests.total_count+'('+percent+'%)'
            }
        }
        break;
        case "Circle Raid":
        case "Circle Pokemon":
        if(instance.status)
        {
            instances[instance.name] = {
                'name':instance.name,
                'status':'Round Time: '+instance.status.round_time+'s'
            }
        }
        else
        {
            instances[instance.name] = {
                'name':instance.name,
                'status': 'Round Time: N/A'
            }
        }
        break;
        case "Pokemon IV":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.iv_per_hour+' IV/H'
        }
        break;
        case "Circle Smart Raid":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.scans_per_h+' Scans/H'
        }
        break;

    }
}

function UpdateInstance(instance)
{
    if(!instances[instance.name])
    {
        AddInstance(instance);
    }
    else
    {
        switch(instance.type)
        {
            case "Auto Quest":
            if(instance.status.bootstrapping)
            {
                let percent = instance.status.bootstrapping.current_count / instance.status.bootstrapping.total_count;
                percent *= 100;
                percent = PrecisionRound(percent, 2);

                instances[instance.name].status = 'Boostrapping: '+instance.status.bootstrapping.current_count+'/'+instance.status.bootstrapping.total_count+'('+percent+'%)';
                
            }
            else
            {
                let percent = instance.status.quests.current_count_db / instance.status.quests.total_count;
                percent *= 100;
                percent = PrecisionRound(percent, 2);

                instances[instance.name].status = instance.status.quests.current_count_db+'/'+instance.status.quests.total_count+'('+percent+'%)';
                
            }
            break;
            case "Circle Raid":
            case "Circle Pokemon":
            if(instance.status)
            {
                instances[instance.name].status = 'Round Time: '+instance.status.round_time+'s';
                
            }
            else
            {
                instances[instance.name].status = 'Round Time: N/A';
                
            }
            break;
            case "Pokemon IV":
            instances[instance.name].status = instance.status.iv_per_hour+' IV/H';            
            break;
            case "Circle Smart Raid":
            instances[instance.name].status = instance.status.scans_per_h+' Scans/H';            
            break;

        }
    }
}

function UpdateDevices()
{
    return new Promise(function(resolve) {
        request.get(config.url+'api/get_data?show_devices=true', {'auth': {'user':config.websiteLogin, 'password':config.websitePassword}, 'jar':true}, (err, res, body) => {
                    
            let data = JSON.parse(body);       

            if(data.status=="error" || !data.data)
            {
                console.log("Could not retrieve data from website: "+data.error);
                resolve(false);
                return;
            }

            if(!data.data.devices)
            {
                console.log("Failed to retrieve device data from the website");
                resolve(false);
                return;
            }
            
            data.data.devices.forEach(function(device) {
                if(!devices[device.uuid])
                {
                    AddDevice(device);
                }
                else
                {
                    UpdateDevice(device);
                }
            });

            resolve(true);

        });
    });
}

function AddDevice(device)
{
    if(config.ignoredDevices.indexOf(device.uuid) != -1) { return }
    devices[device.uuid] = {
        "name":device.uuid,
        "lastSeen": device.last_seen,
        "account": device.username,
        "instance": device.instance,
        "host": device.host,
        "alerted": false        
    };

    if(!devices[device.uuid].lastSeen) { devices[device.uuid].lastSeen = "Never"}
    if(!devices[device.uuid].account) { devices[device.uuid].account = "Unknown"}
    if(!devices[device.uuid].instance) {devices[device.uuid].instance = "Unassigned"}
    if(!devices[device.uuid].host) {devices[device.uuid].host = "Unknown"}
}

function UpdateDevice(device)
{
    if(!devices[device.uuid])
    {
        AddDevice(device);
    }
    else
    {
        devices[device.uuid].lastSeen = device.last_seen;
        devices[device.uuid].account = device.username;
        devices[device.uuid].instance = device.instance;
        devices[device.uuid].host = device.host;        
    }

    if(!devices[device.uuid].lastSeen) { devices[device.uuid].lastSeen = "Never"}
    if(!devices[device.uuid].account) { devices[device.uuid].account = "Unknown"}
    if(!devices[device.uuid].instance) {devices[device.uuid].instance = "Unassigned"}
    if(!devices[device.uuid].host) {devices[device.uuid].host = "Unknown"}
}

function PostStatus()
{
    let now = new Date();
    now = now.toLocaleString();    
    PostDevices().then(posted => {
        PostInstances().then(posted => {           
            PostGroupedDevices().then(posted => {    
                SendOfflineDeviceDMs();                        
                PostLastUpdated().then(posted => {
                    let now = new Date();
                    now = now.toLocaleString();                    
                    setTimeout(PostStatus, 60000 * config.pollingDelay);
                });
            });
        });        
    });
    
}

function PostDevices()
{
    return new Promise(function(resolve) {
        if(!config.postIndividualDevices)
        {            
            resolve(true);
        }
        else
        {
            UpdateDevices().then(updated => {                
                let posts = [];
                for(var deviceID in devices)
                {
                    let device = devices[deviceID];
                    if(device.message)
                    {
                        posts.push(EditDevicePost(device));
                    }
                    else
                    {
                        posts.push(PostDevice(device));
                    }
                }
                
                Promise.all(posts).then(finished => {
                    resolve(true);
                });
            });
        }
    });
}

function PostGroupedDevices()
{
    return new Promise(function(resolve) {
    
        if(config.postDeviceSummary)
        {            
            UpdateDevices().then(updated => {
                let now = new Date();
                now = now.getTime();

                let okDevices = [];
                let warnDevices = [];
                let offlineDevices = [];

                for(var deviceName in devices)
                {
                    let device = devices[deviceName];
                    let lastSeen = new Date(0);
                    lastSeen.setUTCSeconds(device.lastSeen);
                    lastSeen = lastSeen.getTime();
                    lastSeen = now - lastSeen;                
                    if(lastSeen > offlineTime)
                    {
                        offlineDevices.push(device.name);
                    }
                    else if(lastSeen > warningTime)
                    {
                        warnDevices.push(device.name);
                    }
                    else
                    {
                        okDevices.push(device.name);
                    }
                }
                if(okDevices.length == 0) {okDevices.push("None")}
                if(warnDevices.length == 0) {warnDevices.push("None")}
                if(offlineDevices.lenth == 0) {offlineDevices.push("None")}

                

                PostDeviceGroup(okDevices, okColor, okImage, 'Working Devices', okDeviceMessage).then(posted => {
                    okDeviceMessage = posted.id;
                    PostDeviceGroup(warnDevices, warningColor, warningImage, 'Warning Devices', warnDeviceMessage).then(posted => {
                        warnDeviceMessage = posted.id;
                        PostDeviceGroup(offlineDevices, offlineColor, offlineImage, 'Offline Devices', offlineDeviceMessage).then(posted => {
                            offlineDeviceMessage = posted.id;
                            offlineDeviceList = offlineDevices;                            
                            resolve(true);
                        });
                    });
                });    
            });  
        }
        else
        {            
            resolve(true);
        }
        
    });
}

function SendOfflineDeviceDMs()
{
    UpdateDevices().then(updated => {
        let now = new Date();
        now = now.getTime();

        let offlineDevices = [];

        for(var deviceName in devices)
        {
            let device = devices[deviceName];
            let lastSeen = new Date(0);
            lastSeen.setUTCSeconds(device.lastSeen);
            lastSeen = lastSeen.getTime();
            lastSeen = now - lastSeen;                
            if(lastSeen > offlineTime)
            {
                offlineDevices.push(device.name);
            }
        }

        for(var i = 0; i < offlineDevices.length; i++)
        {
            if(!devices[offlineDevices[i]].alerted)
            {
                SendDMAlert(offlineDevices[i]);
                devices[offlineDevices[i]].alerted = true;
            }
        }

        for(var deviceName in devices)
        {
            if(devices[deviceName].alerted && offlineDevices.indexOf(deviceName) == -1)
            {
                devices[deviceName].alerted = false;
                SendDeviceOnlineAlert(deviceName);
            }
        }
    });
}

function SendDMAlert(device)
{
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.log("Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send("Device: "+device+" is offline!").catch(error => {
                console.log("Failed to send a DM to user: "+user.id);
            });
        }
    }
}

function SendDeviceOnlineAlert(device)
{
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.log("Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send("Device: "+device+" has come back online").catch(error => {
                console.log("Failed to send a DM to user: "+user.id);
            });
        }
    }
}


function PostDeviceGroup(deviceList, color, image, title, messageID)
{

    return new Promise(function(resolve) {
        let channel = bot.channels.get(config.channel);

        let deviceString = GetDeviceString(deviceList);
        

        let embed = {
            'title':title,
            'color':color,
            'thumbnail': {'url':image},
            'description': deviceString
        }
        
    

        if(messageID)
        {
            channel.fetchMessage(messageID).then(message => {
                message.edit({embed: embed}).then(posted => {
                    resolve(posted);
                });
            });
        }
        else
        {
            channel.send({embed: embed}).then(posted => {            
            resolve(posted);
            });
        }
    });
}

function GetDeviceString(deviceList)
{
    
    let currentString = "";

    for(var i = 0; i < deviceList.length; i++)
    {
        if(currentString.length + deviceList[i].length + 2 > 2000)
        {
            return currentString + "and more...";
        }
        if(i == deviceList.length - 1)
        {
            currentString = currentString + deviceList[i];
        }
        else
        {
            currentString = currentString + deviceList[i] + ", ";
        }
    }

    
    return currentString;
}

function PostInstances()
{
    return new Promise(function(resolve) {
        if(!config.postInstanceStatus)
        {            
            resolve(true);
        }
        else
        {
            UpdateInstances().then(updated => {                
                let posts = [];
                for(var instanceName in instances)
                {
                    let instance = instances[instanceName];
                    if(instance.message)
                    {
                        posts.push(EditInstancePost(instance));
                    }
                    else
                    {
                        posts.push(PostInstance(instance));
                    }
                }

                Promise.all(posts).then(finished => {
                    resolve(true);                
                });
            });
        }
    });    
}


function PostLastUpdated()
{
    return new Promise(function(resolve) {
        let channel = bot.channels.get(config.channel);
        let now = new Date();
        let lastUpdated = "Last Updated at: **"+now.toLocaleString()+"**";

        if(lastUpdatedMessage)
        {
            channel.fetchMessage(lastUpdatedMessage).then(message => {
                message.edit(lastUpdated).then(edited => {
                    resolve(true);
                });

            });
        }
        else
        {
            channel.send(lastUpdated).then(message => {
                lastUpdatedMessage = message.id;
                resolve(true);
            });
        }        
    });
}

function PostInstance(instance)
{
    return new Promise(function(resolve) {
        let channel = bot.channels.get(config.channel);
        let message = BuildInstanceEmbed(instance);        
        channel.send({'embed': message}).then(message => {
            instance.message = message.id;
            resolve(true);
        });
    });
}

function EditInstancePost(instance)
{
    return new Promise(function(resolve) {
        bot.channels.get(config.channel).fetchMessage(instance.message).then(message => {
            let embed = BuildInstanceEmbed(instance);
            message.edit({'embed': embed}).then(edited => {
                resolve(true);
            });
        });
    });
}

function EditDevicePost(device)
{
    return new Promise(function(resolve) {
        bot.channels.get(config.channel).fetchMessage(device.message).then(message => {
            let embed = BuildDeviceEmbed(device);
            message.edit({'embed': embed}).then(edited => {
                resolve(true);
            });
        });
    });
}

function PostDevice(device)
{
    return new Promise(function(resolve) {
        let channel = bot.channels.get(config.channel);
        let message = BuildDeviceEmbed(device);
        channel.send({embed:message}).then(message => {
            device.message = message.id;
            resolve(true);
        });
    });
}

function BuildInstanceEmbed(instance)
{
    let deviceList = GetDeviceList(instance);

    let color = 0x0000FF;
    
    let now = new Date();

    let instanceDevices = "";
    if(deviceList.devices.length > 0)
    {
        instanceDevices = deviceList.devices.toString();
    }
    else
    {
        instanceDevices = "None";
    }

    let fields = [
        {'name':'Status', 'value':instance.status, 'inline':true},
        {'name':'Device Count: ', 'value':deviceList.count, 'inline':true},
        {'name':'Device List: ', 'value':instanceDevices, 'inline':true}
    ];
    let embed = {
        'title':instance.name,
        'color':color,
        'fields': fields,
        'footer': {'text':'Last Updated: '+now.toLocaleString() }

    }

    return embed;
}

function BuildDeviceEmbed(device)
{
    let fields = [];

    let color = okColor;
    let image = okImage;

    if(config.showLastSeen)
    {
        let now = new Date();
        now = now.getTime();
        let lastSeen = new Date(0);
        lastSeen.setUTCSeconds(device.lastSeen);
        fields.push({'name':'Last Seen: ', 'value': lastSeen.toLocaleString(), 'inline':true});
          
        let lastSeenDifference = now - lastSeen.getTime();
        if(lastSeenDifference > warningTime)
        {
            color = warningColor;
            image = warningImage;
        }
        if(lastSeenDifference > offlineTime)
        {
            color = offlineColor;
            image = offlineImage;
        }
    }
    if(config.showInstance)
    {
        fields.push({'name':'Instance', 'value':device.instance, 'inline':true});
    }
    if(config.showAccount)
    {        
        fields.push({'name':'Account', 'value':device.account, 'inline':true});
    }
    if(config.showHost)
    {
        fields.push({'name':'Host', 'value':device.host, 'inline':true});
    }

    let now = new Date();

    let embedMSG = {
        'title': device.name,
        'color': color,
        'thumbnail': {url: image},
        'fields':fields,
        'footer': {'text':'Last Updated: '+now.toLocaleString() }
    };

    return embedMSG;
}

function ClearMessages()
{
    return new Promise(function(resolve) {
        if(config.clearMessagesOnStartup && !cleared)
        {            
            cleared = true;
            let channel = bot.channels.get(config.channel);
            channel.fetchMessages({limit:99}).then(messages => {                
                channel.bulkDelete(messages).then(deleted => {
                    if(messages.size > 0)
                    {
                        ClearMessages().then(resolve(true));
                    }
                    else
                    {
                        resolve(true);
                    }
                }).catch(console.error, resolve(false));
            });
        }
        else
        {
            resolve(true);
        }
    });
}

function GetDeviceList(instance)
{
    let count = 0;
    let deviceList = [];

    for(var deviceID in devices)
    {
        let device = devices[deviceID];
        if(device.instance===instance.name) { count++; deviceList.push(deviceID); }
    }

    return {'count':count, 'devices':deviceList };
}

function PrecisionRound(number, precision) 
{
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

bot.on('error', (err) => {
    console.log('An error occured: ${err}');
});