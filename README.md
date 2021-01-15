# Information

This is a continuation of RDMMonitor by Chuckslove <https://github.com/chuckleslove/RDMMonitor>. We will continue to improve this repo where needed and keep it alive in his memory.

# Requirements

npm install request

npm install discord.js

# RDMDeviceMonitor

Simple Discord Bot to monitor device status for RDM


Config options

token: Mandator, discord bot token, bot should have send message and manage message permissions in the designated channel
channel: Default channel ID of where to post device/instance status
deviceStatusChannel: Specific channel ID of where to post device status
instanceStatusChannel: Specific channel ID of where to post instance status
deviceSummaryChannel: Specific channel ID of where to post the device summary

userAlerts: an array of user IDs to DM upon device going offline
url: URL of your RDM website, by default IP:9000 but can use actual URL if you have a properly configured reverse proxy
websiteLogin: Username to login with
websitePassword: Password for the username

The above user must have admin access to the website

postIndividualDevices: true/false - Bool to post each device individually
postInstanceStatus: true/false - Bool to post instance status
postDeviceSummary: true/false - Bool to post device status in a single block by current status

showInstance: Show which instance a device is assigned to on the indThe ttividual device post
showAccount: Show account assigned on device post
showHost: Show host IP for the device
showLastSeen: Show when the device was last seen
showBuildCount: Show the amount of times a device rebuilt
showOnlineTime: Show how long the deviceThe ttThe ttThe tt has been online

clearMessagesOnStartup: Will delete all messages in the channel it is going to post to, this is to clear out posts from past history, DO NOT set this to true if you don't have a dedicated channel for device status as this will wipe out the channel

ignoredDevices: An array of strings for the overall device blacklist
ignoredInstances: An array of strings for the instance blacklist
postingDelay: The time in minutes to delay different posting triggers

warningTime: The time in minutes to consider a device in warning state
offlineTime: The time in minutes a device must be offline before marked as red/offline and send a DM to the designated users
rebuildTime: The time in minutes to consider a device is rebuilding

queueLimit: A number for the IV queue limit

allowReopenGame: true/false - Bool to enable RDMDeviceMonitor to send a reopen game request to a monitor
reopenTime: The time in minutes to request a device to reopen the game
reopenMonitorURL: An array of strings for the URLs of the reopen game monitors you are using like iPhone Controller or DCM Listener
excludeFromReopen: An array of strings that are the unique names of the devices to exclude from the reopen game request

allowWarnReboots: true/false - Bool to enable RDMDeviceMonitor to send a reboot request to a monitor
rebootMonitorURL: An array of strings for the URLs of the reboot monitors you are using like iPhone Controller or DCM Listener
sendRebootAlerts: true/false - Bool to enable the DM message for rebooting a device
excludeFromReboots: An array of strings that are the unique names of the devices to exclude from the reboot request
