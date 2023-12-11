# Information

This is a continuation of RDMMonitor by Chuckslove <https://github.com/chuckleslove/RDMMonitor>. We will continue to improve this repo where needed and keep it alive in his memory.

Rotomonitor is a simple discord bot to monitor device status for Rotom <https://github.com/UnownHash/Rotom>.

<hr />

# SETTING UP THE BOT:

1. Download `Node.js ver v18.19.0` from https://nodejs.org/en/download/

2. Run `git clone https://github.com/Kneckter/Rotomonitor` to copy the bot.

3. Change into the new folder `cd Rotomonitor/`.

4. Run `npm install`.

5. Copy the example file `cp RotomonitorConfig.example.json RotomonitorConfig.json`.

6. Create an applicaiton and get the your bot's secret token, and application ID at:
   * https://discordapp.com/developers/applications/me

7. Get your application/bot to join your server by going here:
   * https://discordapp.com/developers/tools/permissions-calculator
   * Check the boxes for the needed permissions
     * Minimum requirements: manage messages, send messages, read message history
   * Use the URL that the page generates and go to it, and you will be asked to log into your discord. You will need **Admin** access in order to get the bot to join that server.

8. Fill out the information needed in `nano RotomonitorConfig.json`.

<hr />

# SETTINGS
```
token: Mandator, discord bot token, bot should have send message and manage message permissions in the designated channel

channel: Default channel ID of where to post device/instance status
deviceSummaryChannel: Specific channel ID of where to post the device summary

userAlerts: an array of user IDs to DM upon device going offline

rotomURL: URL of your Rotom admin interface, by default IP:7072 but can use actual URL if you have a properly configured reverse proxy
basicUsername: Username for reverse proxy BasicAuth.
basicPassword: Password for reverse proxy BasicAuth.

postDeviceSummary: true/false - Bool to post device status in a single block by current status

clearMessagesOnStartup: Will delete all messages in the channel it is going to post to, this is to clear out posts from past history, DO NOT set this to true if you don't have a dedicated channel for device status as this will wipe out the channel

ignoredDevices: An array of strings for the overall device blacklist

postingDelay: The time in minutes to delay different posting triggers

warningTime: The time in minutes to consider a device in warning state
offlineTime: The time in minutes a device must be offline before marked as red/offline and send a DM to the designated users

allowReopenGame: true/false - Bool to enable Rotomonitor to send a reopen game request to a monitor
reopenTime: The time in minutes to request a device to reopen the game
reopenMonitorURL: An array of strings for the URLs of the reopen game monitors you are using like iPhone Controller or DCM Listener
excludeFromReopen: An array of strings that are the unique names of the devices to exclude from the reopen game request

allowReapplySAM: true/false - Bool to enable Rotomonitor to send a request to a monitor for reapplying the SAM profile.
reapplySAMTime: The time in minutes to request a device have the SAM profile reapplied automatically. DO NOT put this timer 2 minutes from a reboot, it could cause the phone to have no SAM profile. 
reapplySAMMonitorURL: An array of strings for the URLs of the reapply SAM monitors you are using like iPhone Controller or DCM Listener
excludeFromReapplySAM: An array of strings that are the unique names of the devices to exclude from the reapply SAM request

allowWarnReboots: true/false - Bool to enable Rotomonitor to send a reboot request to a monitor
rebootAgainTimer: The time in minutes to wait before trying another reboot, in case the last reboot did not bring the device online
maxRebootRetries: A number for limiting the amount of times a device is rebooted
rebootMonitorURL: An array of strings for the URLs of the reboot monitors you are using like iPhone Controller or DCM Listener
sendRebootAlerts: true/false - Bool to enable the DM message for rebooting a device
excludeFromReboots: An array of strings that are the unique names of the devices to exclude from the reboot request

brightnessMonitorURL: An array of strings for the URLs of the brightness monitors you are using like iPhone Controller or DCM Listener

cmdPrefix: A single character used to identify commands that the bot should react to
adminRoleName: This is a string for the name of the main role that will admin the bot
```

# LAUNCHING IT

Using terminal, run `node Rotomonitor.js` or `node Rotomonitor.js config.json` if specifying a config file.

   * If you close that window, the bot connection will be terminated! You can add it to PM2 if you want it to run in the background.

Instead, add it to PM2 with `pm2 start ecosystem.config.js`

<hr />

# USAGE

`.help`<br>
--`.restart`   »   to manually restart the whole bot<br>
--`.reopen <DEVICE-NAMES>`   »   to reopen the game on specific devices<br>
--`.reboot <DEVICE-NAMES>`   »   to reboot the specific devices<br>
--`.sam <DEVICE-NAMES>`   »   to reapply the SAM profile to the specific devices<br>
--`.delete <DEVICE-NAMES>`   »   to delete the specific devices from the monitor<br>
--`.brightness <VALUE>, <DEVICE-NAMES>`   »   to change the brightness on the specific devices<br>

The commands with `<DEVICE-NAMES>` accept multiple names separated by commas.<br>
They can be used to skip the exclusion list if you specify a name on the list.<br>
They can accept `all`, `allwarn`, or `alloff` to apply to groups but will omit devices on the exclude lists.