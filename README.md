# Requirements

npm install request
npm install discord.js

# RDMDeviceMonitor

Simple Discord Bot to monitor device status for RDM


Config options

token: Mandator, discord bot token, bot should have send message and manage message permissions in the designated channel
channel: channel ID of where to post device/instance status
userAlerts: an array of user IDs to DM upon device going offline

url: url of your RDM website, by default IP:9000 but can use actual URL if you have a properly configured reverse proxy
websiteLogin: username to login with
websitePassword: password for the username

The above user must have admin access to the website

postIndividualDevices:true/false - bool to post each device individually
postInstanceStatus:true/false - bool to post instance status
postDeviceSummary:true/false - bool to post device status in a single block by current status

showInstance - show which instance a device is assigned to on the individual device post
showAccount - show account assigned on device post
showHost - show host IP for the device
showLastSeen - show when the device was last seen

clearMessagesOnStartup - will delete all messages in the channel it is going to post to, this is to clear out posts from past history, DO NOT set this to true if you don't have a dedicated channel for device status as this will wipe out the channel

pollingDelay - delay in minutes in between checking device/instance status.  A value of 0 would check immediately after it finishes checking/posting status, .5 would be 30 seconds, 1 would be 60 seconds, etc...

warningTime - the time in milliseconds a device must be offline before marked as yellow/warning, by default 60000(1 minute)
offlineTime - the time in milliseconds a device must be offline before marked as red/offline and send a DM to the designated users, by default 900000(15 minutes)

