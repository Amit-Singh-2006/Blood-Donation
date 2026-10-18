# Sets up the daily LifeLink database backup (scripts/backup.ts) in Windows
# Task Scheduler, for the signed-in user. Run it once from PowerShell:
#
#   powershell -ExecutionPolicy Bypass -File server\scripts\schedule-backup.ps1
#
# Run it again to change the time (-At 22:00) or to repair the task. If the PC
# is off at that time, the backup runs as soon as you next sign in.
param([string]$At = '21:30')

$ErrorActionPreference = 'Stop'
$server = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$arguments = '-r ts-node/register/transpile-only scripts/backup.ts'

# conhost --headless runs node without a console window flashing up each evening
$conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
$action = if (Test-Path $conhost) {
    New-ScheduledTaskAction -Execute $conhost -Argument "--headless `"$node`" $arguments" -WorkingDirectory $server
} else {
    New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $server
}
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName 'LifeLink database backup' -Action $action -Trigger $trigger -Settings $settings -Force `
    -Description 'Encrypted backup of the LifeLink database (server\scripts\backup.ts). Results: backup.log in the backup folder.' | Out-Null

Write-Host "Daily LifeLink backup scheduled at $At. Run it now with: Start-ScheduledTask -TaskName 'LifeLink database backup'"
