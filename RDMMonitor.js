const Discord=require('discord.js');
const bot=new Discord.Client();
const request = require('request');
const config = require('./RDMMonitorConfig.json');


const warningImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/warned.png";
const okImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/ok.png";
const offlineImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/offline.png";
const instanceImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/instance.png";
const pokemonImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/pokemon.png";
const raidImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/raids.png";
const researchImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/research.png";
const ivImage = "https://raw.githubusercontent.com/chuckleslove/RDMMonitor/master/static/iv.png";

const warningTime = config.warningTime * 60000;
const offlineTime = config.offlineTime * 60000;
const rebuildTime = config.rebuildTime * 60000;

const okColor = 0x008000;
const warningColor = 0xFFFF00;
const offlineColor = 0xFF0000;

const pokemonColor = 0xC0C0C0;
const raidColor = 0x9400D3;
const researchColor = 0xFF7F50;
const ivColor = 0xDAA520;

const DEVICE_QUERY = 'api/get_data?show_devices=true';
const INSTANCE_QUERY = 'api/get_data?show_instances=true';
const IV_QUERY = '/api/get_data?show_ivqueue=true&formatted=true&instance=';

const WEBSITE_AUTH = {'auth': {'user':config.websiteLogin, 'password':config.websitePassword}, 'jar':true};

var postingDelay = config.postingDelay * 60000;

var devices = {};
var instances = {};
var okDeviceMessage = "";
var warnDeviceMessage = "";
var offlineDeviceMessage = "";
var lastUpdatedMessage = "";
var channelsCleared = false;



bot.login(config.token);

bot.on('message', message => {
	switch(message.channel.id){
		case config.channel:
		case config.deviceStatusChannel:
		case config.instanceStatusChannel:
		case config.deviceSummaryChannel:
			if(message.content == 'restart'){ RestartBot('manual'); } break;
		default: return;
	}
});

bot.on('ready', () => {
    
    if(config.warningTime > 1000 || config.offlineTime > 1000)
    {
        console.log(GetTimestamp()+"WARNING warningTime and offlineTime should be in MINUTES not milliseconds");
    }    

    
    if(isNaN(postingDelay)) { postingDelay = 0; }
    
    
   
    StartupSequence();      
      
    return;
    
});

async function StartupSequence()
{
    await ClearAllChannels();
    await UpdateStatusLoop();        
    await PostStatus();  
    return;
}

async function UpdateStatusLoop()
{       
    console.log(GetTimestamp()+"Beginning RDM query");    
    await UpdateDevices();
    await UpdateInstances();
    console.log(GetTimestamp()+"Finished RDM query");
    setTimeout(UpdateStatusLoop, 5000);
    return;  

}

function UpdateInstances()
{    
    return new Promise(function(resolve) {
        request.get(config.url+INSTANCE_QUERY, WEBSITE_AUTH, (err, res, body) => {

            if(err)
            {
                console.error(GetTimestamp()+"Error querying RDM: "+err.code);
                return resolve();                
            }
        
            var data;
            try {
                data = JSON.parse(body);
            } catch(err) {
                console.error(GetTimestamp()+"Could not retrieve data from website: "+body);
                console.error(GetTimestamp()+err);
                return resolve();                
            }

            if(data.status=="error" || !data.data || !data)
            {
                console.error(GetTimestamp()+"Could not retrieve data from website: "+data.error);
                return resolve();                
            }
            
            if(!data.data.instances)
            {
                console.error(GetTimestamp()+"Failed to retrieve instance data from the website");
                return resolve();                
            }
            
            data.data.instances.forEach(async function(instance) {
                if(!instances[instance.name])
                {
                    AddInstance(instance);
                    if(instance.type == "Pokemon IV")
                    {
                        instances[instance.name].queue = await GetIVQueue(instance.name);                        
                    }
                }
                else
                {
                    UpdateInstance(instance);
                    if(instance.type == "Pokemon IV")
                    {
                        instances[instance.name].queue = await GetIVQueue(instance.name);                        
                    }
                }
            });    
            return resolve();                     
        });             
    });
}

function AddInstance(instance)
{
    if(config.ignoredInstances.length > 0)
    {
        if(config.ignoredInstances.indexOf(instance.name) != -1) { return }
    }
    if(!instance.status) { return; }
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
                'status':'Boostrapping: '+instance.status.bootstrapping.current_count+'/'+instance.status.bootstrapping.total_count+'('+percent+'%)',
                'type':'research'
            }
        }
        else
        {
            if(!instance.status.quests) { console.log("Your RDM is out of date, please pull the latest from docker"); process.exit(0); return; }            
            let percent = instance.status.quests.current_count_db / instance.status.quests.total_count;
            percent *= 100;
            percent = PrecisionRound(percent, 2);

            instances[instance.name] = {
                'name':instance.name,
                'status':instance.status.quests.current_count_db+'/'+instance.status.quests.total_count+'('+percent+'%)',
                'type':'research'
            }
        }
        break;
        case "Circle Raid":      
        if(instance.status)
        {
            instances[instance.name] = {
                'name':instance.name,
                'status':'Round Time: '+instance.status.round_time+'s',
                'type':'raid'
            }
        }
        else
        {
            instances[instance.name] = {
                'name':instance.name,
                'status': 'Round Time: N/A',
                'type':'raid'
            }
        }
        break;  
        case "Circle Pokemon":
        if(instance.status)
        {
            instances[instance.name] = {
                'name':instance.name,
                'status':'Round Time: '+instance.status.round_time+'s',
                'type':'pokemon'
            }
        }
        else
        {
            instances[instance.name] = {
                'name':instance.name,
                'status': 'Round Time: N/A',
                'type':'pokemon'
            }
        }
        break;
        case "Pokemon IV":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.iv_per_hour+' IV/H',
            'type':'iv'
        }
        break;
        case "Circle Smart Raid":
        instances[instance.name] = {
            'name':instance.name,
            'status':instance.status.scans_per_h+' Scans/H',
            'type':'raid'
        }        
        break;
        default:
        return;
    }
    return;
}

function UpdateInstance(instance)
{
    if(!instances[instance.name])
    {
        AddInstance(instance);
    }
    else
    {
        if(!instance.status) { return; }
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
    return;
}

function UpdateDevices()
{
    return new Promise(function(resolve) {
        request.get(config.url+DEVICE_QUERY, WEBSITE_AUTH, (err, res, body) => {

            if(err)
            {
                console.error(GetTimestamp()+"Error querying RDM: "+err.code);
                return resolve();                
            }
                    
            var data;
            try {
                data = JSON.parse(body);
            } catch(err) {
                console.error(GetTimestamp()+"Could not retrieve data from website: "+body);
                console.error(GetTimestamp()+err);
                return resolve();                
            }    

            if(data.status=="error" || !data.data)
            {
                console.error(GetTimestamp()+"Could not retrieve data from website: "+data.error);
                return resolve();                
            }

            if(!data.data.devices)
            {
                console.error(GetTimestamp()+"Failed to retrieve device data from the website");
                return resolve();                
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
            return resolve();   
        });
             
    });    
}

function AddDevice(device)
{
    if(config.ignoredDevices.length > 0)
    {
        if(config.ignoredDevices.indexOf(device.uuid) != -1) { return; } 
    }

    devices[device.uuid] = {
        "name":device.uuid,
        "lastSeen": device.last_seen,
        "account": device.username,
        "instance": device.instance,
        "host": device.host,
        "alerted": false,
        "builds":0
    };

    if(!devices[device.uuid].lastSeen) { devices[device.uuid].lastSeen = "Never"}
    if(!devices[device.uuid].account) { devices[device.uuid].account = "Unknown"}
    if(!devices[device.uuid].instance) {devices[device.uuid].instance = "Unassigned"}
    if(!devices[device.uuid].host) {devices[device.uuid].host = "Unknown"}

    return UpdateDeviceState(devices[device.uuid]);
    
}

function UpdateDevice(device)
{
    if(!devices[device.uuid])
    {
        return AddDevice(device);        
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

    return UpdateDeviceState(devices[device.uuid]);
    
}

function PostStatus()
{       
    PostDevices();
    PostInstances();
    PostGroupedDevices();
    SendOfflineDeviceDMs();   
         
    return;      
    
}

async function PostDevices()
{             
    if(!config.postIndividualDevices)
    {            
        return;            
    }
    else
    {    
        console.log(GetTimestamp()+"Posting device status"); 
        for(var deviceID in devices)
        {
            let device = devices[deviceID];
            if(device.message)
            {                
                await EditDevicePost(device);
                await sleep(1000);
            }
            else
            {                
                await PostDevice(device);
                await sleep(1000);
            }
        }
        
       
        console.log(GetTimestamp()+"Finished posting device status");
        setTimeout(PostDevices,postingDelay);        
        return;        
    }    
       
}

async function PostGroupedDevices()
{
    
    return new Promise(function(resolve) {          
        if(config.postDeviceSummary)
        {  
            console.log(GetTimestamp()+"Posting device summary");
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
            if(offlineDevices.length == 0) {offlineDevices.push("None")}

            

            PostDeviceGroup(okDevices, okColor, okImage, 'Working Devices', okDeviceMessage).then(posted => {
                okDeviceMessage = posted.id;
                PostDeviceGroup(warnDevices, warningColor, warningImage, 'Warning Devices', warnDeviceMessage).then(posted => {
                    warnDeviceMessage = posted.id;
                    PostDeviceGroup(offlineDevices, offlineColor, offlineImage, 'Offline Devices', offlineDeviceMessage).then(posted => {
                        offlineDeviceMessage = posted.id;
                        offlineDeviceList = offlineDevices;   
                        PostLastUpdated();
                        console.log(GetTimestamp()+"Finished posting device summary");
                        setTimeout(PostGroupedDevices, postingDelay);
                        return resolve();                        
                    });
                });
            });    
            
        }
        else
        {            
            return resolve();           
        }        
    });
}

function SendOfflineDeviceDMs()
{
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

    setTimeout(SendOfflineDeviceDMs,60000);
    return;
    
}

function SendDMAlert(device)
{    
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.error(GetTimestamp()+"Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send(GetTimestamp()+" Device: "+device+" is offline!").catch(error => {
                console.error(GetTimestamp()+"Failed to send a DM to user: "+user.id);
                return;
            });
        }
    }
    return;
}

function SendDeviceOnlineAlert(device)
{    
    for(var i = 0; i < config.userAlerts.length; i++)
    {
        let user = bot.users.get(config.userAlerts[i]);
        if(!user)
        {
            console.error(GetTimestamp()+"Cannot find a user to DM with ID: "+config.userAlerts[i]);
        }
        else
        {
            user.send(GetTimestamp()+" Device: "+device+" has come back online").catch(error => {
                console.error(GetTimestamp()+"Failed to send a DM to user: "+user.id);
            });
        }
    }
    return;
}


function PostDeviceGroup(deviceList, color, image, title, messageID)
{

    return new Promise(function(resolve) {
        let channel = config.deviceSummaryChannel ? bot.channels.get(config.deviceSummaryChannel) : bot.channels.get(config.channel);

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
                if(!message)
                {
                    console.error(GetTimestamp()+"Missing device summary message");
                    return resolve();                    
                }
                message.edit({embed: embed}).then(posted => {
                    return resolve(posted);
                }).catch(error => {
                    console.error(GetTimestamp()+"Failed to edit a post: "+error);
                    return resolve();
                });
            });
        }
        else
        {
            channel.send({embed: embed}).then(posted => {            
            return resolve(posted);            
            }).catch(err => {
                console.error(GetTimestamp()+"Error sending a message: "+err);
                return resolve();
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

async function PostInstances()
{

    if(!config.postInstanceStatus)
    {            
        return resolve();            
    }
    else
    {        
        console.log(GetTimestamp()+"Posting instance status"); 
        let posts = [];
        for(var instanceName in instances)
        {
            let instance = instances[instanceName];
            if(instance.message)
            {
                await EditInstancePost(instance);
                await sleep(1000);
            }
            else
            {
                await PostInstance(instance);
                await sleep(1000);
            }
        }

            console.log(GetTimestamp()+"Finished posting instance status");
            setTimeout(PostInstances,postingDelay);                
            return;                               
                
    }        
       
}


function PostLastUpdated()
{
        
    let channel = config.deviceSummaryChannel ? bot.channels.get(config.deviceSummaryChannel) : bot.channels.get(config.channel);
    let now = new Date();
    let lastUpdated = "Last Updated at: **"+now.toLocaleString()+"**";

    if(lastUpdatedMessage)
    {
        channel.fetchMessage(lastUpdatedMessage).then(message => {
            if(!message)
            {                    
                return;                  
            }
            message.edit(lastUpdated).then(edited => {
                lastUpdatedMessage = edited.id;
                return;                    
            }).catch(error => {
                console.log(GetTimestamp()+"Failed to edit a post: "+error);
                return;
            });

        });
    }
    else
    {
        channel.send(lastUpdated).then(message => {
            lastUpdatedMessage = message.id;
            return;              
        }).catch(err => {
            console.error(GetTimestamp()+"Error sending a message: "+err);
            return;
        });
    }             
    
}

function PostInstance(instance)
{
    return new Promise(function(resolve) {
        let channel = config.instanceStatusChannel ? bot.channels.get(config.instanceStatusChannel) : bot.channels.get(config.channel);
        let message = BuildInstanceEmbed(instance);        
        channel.send({'embed': message}).then(message => {
            instance.message = message.id;
            return resolve();            
        }).catch(err => {
            console.error(GetTimestamp()+"Error sending a message: "+err);
            return resolve();
        });        
    });
}

function EditInstancePost(instance)
{
    return new Promise(function(resolve) {
        let channel = config.instanceStatusChannel ? bot.channels.get(config.instanceStatusChannel) : bot.channels.get(config.channel);
        channel.fetchMessage(instance.message).then(message => {
            if(!message)
                {
                    console.error(GetTimestamp()+"Missing instance message");
                    return resolve();                    
                }
            let embed = BuildInstanceEmbed(instance);
            message.edit({'embed': embed}).then(edited => {
                return resolve();                
            }).catch((error) => {
                console.error(GetTimestamp()+"Failed to edit an instance message: "+error);
                return resolve();
            });
        });        
    });
}

function EditDevicePost(device)
{
    return new Promise(function(resolve) {
        let channel = config.deviceStatusChannel ? bot.channels.get(config.deviceStatusChannel) : bot.channels.get(config.channel);
        channel.fetchMessage(device.message).then(message => {
            if(!message)
                {
                    console.error(GetTimestamp()+"Missing device message");
                    return resolve();                    
                }
            let embed = BuildDeviceEmbed(device);
            message.edit({'embed': embed}).then(edited => {
                return resolve();                
            }).catch((error) => {
                console.error(GetTimestamp()+"Failed to edit a device post: "+error);
                return resolve();
            });
        });        
    });
}

function PostDevice(device)
{
    return new Promise(resolve => {        
        let channel = config.deviceStatusChannel ? bot.channels.get(config.deviceStatusChannel) : bot.channels.get(config.channel);
        let message = BuildDeviceEmbed(device);
        channel.send({embed:message}).then(message => {
            device.message = message.id;
            return resolve();           
        }).catch(err => {
            console.error(GetTimestamp()+"Error sending a message: "+err);
            return resolve();
        });  
    });
}

function BuildInstanceEmbed(instance)
{
    let deviceList = GetDeviceList(instance);

    let color = 0x0000FF;    
    
    let now = new Date();
    
    let image = instanceImage;

    switch(instance.type)
    {
        case 'research':
        image = researchImage;
        color = researchColor;
        break;
        case 'pokemon':
        image = pokemonImage;
        color = pokemonColor;
        break;
        case 'raid':
        image = raidImage;
        color = raidColor;
        break;
        case 'iv':
        image = ivImage;
        color = ivColor;
        break;
        default:
        break;
    }

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

    if(instance.type == 'iv' && instance.queue)
    {
        fields = [
            {'name':'Status', 'value':instance.status, 'inline':true},
            {'name':'Device Count: ', 'value':deviceList.count, 'inline':true},
            {'name':'Queue', 'value':instance.queue, 'inline':true},
            {'name':'Device List: ', 'value':instanceDevices, 'inline':true}
        ];
    }
    let embed = {
        'title':instance.name,
        'color':color,
        'fields': fields,
        'thumbnail': {url: image},
        'footer': {'text':'Last Updated: '+now.toLocaleString() }

    }

    return embed;
}

function BuildDeviceEmbed(device)
{
    let fields = [];

    let color = okColor;
    let image = okImage;
    
    let now = new Date();
    now = now.getTime();

    if(config.showLastSeen)
    {
        
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
    if(config.showBuildCount)
    {    
        fields.push({'name':'Build Count', 'value':device.builds, 'inline':true});
    }
    if(config.showOnlineTime)
    {
        let currentUptime = 0;
        if(device.state=="ok")
        {
            currentUptime = (now - device.lastBuildTimestamp) / 1000;
        }

        fields.push({'name':'Current Uptime', 'value':currentUptime + 's', 'inline':true});
        fields.push({'name':'Last Build', 'value':device.lastBuild, 'inline':true});
    }
   

    let embedMSG = {
        'title': device.name,
        'color': color,
        'thumbnail': {url: image},
        'fields':fields,
        'footer': {'text':'Last Updated: '+new Date().toLocaleString() }
    };

    return embedMSG;
}

function ClearAllChannels()
{
    
    return new Promise(function(resolve) {
        if(!config.clearMessagesOnStartup || channelsCleared) { return resolve(); }

        let cleared = [];

        cleared.push(ClearMessages(config.channel));
        cleared.push(ClearMessages(config.deviceStatusChannel));
        cleared.push(ClearMessages(config.instanceStatusChannel));
        cleared.push(ClearMessages(config.deviceSummaryChannel));        

        Promise.all(cleared).then(done => {
            channelsCleared = true;
            return resolve();            
        });

    });
}

function ClearMessages(channelID)
{    
    return new Promise(function(resolve) {
    
        if(channelsCleared) { return resolve(); }
        let channel = bot.channels.get(channelID);
        if(!channel) { console.error(GetTimestamp()+"Could not find a channel with ID: "+channelID); return resolve(); }
        channel.fetchMessages({limit:99}).then(messages => {                
            channel.bulkDelete(messages).then(deleted => {
                if(messages.size > 0)
                {
                    ClearMessages(channelID).then(result => {
                        return resolve();                        
                    });
                    
                }
                else
                {
                    return resolve();                    
                }
            }).catch(error => {
                console.error(GetTimestamp()+"Failed to clear channel messages");
                return resolve();
            });
        });        
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

function UpdateDeviceState(device)
{
    let now = new Date().getTime();
    let lastSeen = new Date(0);
    lastSeen.setUTCSeconds(device.lastSeen);
    lastSeen = lastSeen.getTime();
    lastSeen = now - lastSeen;
    
    let deviceState = "ok";
    if(lastSeen > rebuildTime) {deviceState = "warn"}
    if(lastSeen > offlineTime) {deviceState = "offline"}    
    

    if(!device.state)
    {
        device.state = deviceState;
        if(deviceState=="ok")
        {
            device.lastBuild = "Before Bot startup";
            device.lastBuildTimestamp = new Date().getTime();
        }
        else
        {
            device.lastBuild = "Never";
            device.lastBuildTimestamp = null;
        }
    }
    else if(device.state == deviceState)
    {
        return;
    }
    else
    {        
        device.state = deviceState;
        switch(deviceState)
        {
            case "ok":
            device.lastBuild = new Date().toLocaleString();
            device.lastBuildTimestamp = new Date().getTime();
            break;
            case "warn":
            device.builds++;
            break;
            case "offline":
            break;
            default:
            break;
        }
    }
    return;
}

function PrecisionRound(number, precision) 
{
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

function GetTimestamp()
{
    let now = new Date();

    return "["+now.toLocaleString()+"]";
}

function RestartBot(type)
{
    if(type == 'manual'){ process.exit(1); }
    else{
        console.error(GetTimestamp()+"Unexpected error, bot stopping, likely websocket");  
        process.exit(1);
    }
    return;
}

bot.on('error', function(err)  {      
    if(typeof err == 'object')
    {
        err = JSON.stringify(err);
    }
    console.error(GetTimestamp()+'Uncaught exception: '+err);
    RestartBot();
    return;
});

process.on('uncaughtException', function(err) { 
    if(typeof err == 'object')
    {
        err = JSON.stringify(err);
    }
    console.error(GetTimestamp()+'Uncaught exception: '+err);
    RestartBot();
    return;
});

process.on('unhandledRejection', function(err) {  
    if(typeof err == 'object')
    {
        err = JSON.stringify(err);
    } 
    console.error(GetTimestamp()+'Uncaught exception: '+err);
    RestartBot();
    return;
});

bot.on('disconnect', function(closed) {
    console.error(GetTimestamp()+'Disconnected from Discord'); 
    return;   
});

async function sleep(ms)
{
    return new Promise(resolve => {
        setTimeout(resolve,ms);
    });
}

function GetIVQueue(instanceName)
{
    let queueLimit = config.queueLimit ? config.queueLimit : 5;

    return new Promise(function(resolve) {
        if(config.queueLimit == 0) { return resolve(''); }
        
        request.get(config.url+IV_QUERY+instanceName, WEBSITE_AUTH, (err, res, body) => {

            
            let queue = '';
            if(err)
            {
                console.error(GetTimestamp()+"Error querying RDM: "+err.code);
                return resolve();                
            }

            let data = JSON.parse(body).data;
            

            for(var i = 0; i < data.ivqueue.length; i++)
            {
                queue += "Pokemon: **"+data.ivqueue[i].pokemon_name+"** Location: **"+data.ivqueue[i].location+"**\n";
                if(i >= queueLimit - 1) { i = data.ivqueue.length; }                
            }

            return resolve(queue);
        });
    });
}