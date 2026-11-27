[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [ValidateSet('67f29b83d383f83a5035f6dbbda852c4ccf60e12060b3f9137623af9bf17c329', 'd0a67cee8cf8611eeffd8836ba01625803affd01ac3e6919948188245e0f667b')]
    [string]$ContainerId = '67f29b83d383f83a5035f6dbbda852c4ccf60e12060b3f9137623af9bf17c329',
    [switch]$Remove,
    [switch]$StopContainer
)

$ErrorActionPreference = 'Stop'
if ($Remove -and $StopContainer) { throw 'Stop and remove require separate invocations.' }
if (($Remove -or $StopContainer) -and (-not $PSBoundParameters.ContainsKey('Confirm') -or -not $PSBoundParameters['Confirm'])) {
    throw 'Each operation requires the explicit -Confirm switch.'
}
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$image = 'sha256:64c8b0d31e4ab6ea665e8426ea406a94bf52de3c05b3a4a8bf713704eefa9328'
$targets = @(
    @{ Id = '67f29b83d383f83a5035f6dbbda852c4ccf60e12060b3f9137623af9bf17c329'; Name = 'focusstore-test-0140aca0927c4841967e3a400a14e477'; Run = '0140aca0-927c-4841-967e-3a400a14e477' },
    @{ Id = 'd0a67cee8cf8611eeffd8836ba01625803affd01ac3e6919948188245e0f667b'; Name = 'focusstore-test-ed958ce15968464197592fed17166f13'; Run = 'ed958ce1-5968-4641-9759-2fed17166f13' }
)

function Assert-Target($target, $expectedState) {
    foreach ($key in @('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')) {
        if ([Environment]::GetEnvironmentVariable($key)) { throw 'Docker environment override detected.' }
    }
    $contextName = & $docker context show
    if ($LASTEXITCODE -ne 0 -or $contextName -ne 'desktop-linux') { throw 'Unexpected Docker context.' }
    $context = @((& $docker context inspect desktop-linux | ConvertFrom-Json))
    if ($LASTEXITCODE -ne 0 -or $context.Count -ne 1 -or $context[0].Name -ne 'desktop-linux' -or
        $context[0].Endpoints.docker.Host -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') { throw 'Unexpected Docker endpoint.' }
    $result = @((& $docker --context desktop-linux inspect $target.Id | ConvertFrom-Json))
    if ($LASTEXITCODE -ne 0 -or $result.Count -ne 1) { throw 'Container inspection failed.' }
    $c = $result[0]
    if ($c.Id -ne $target.Id -or $c.Name -ne ('/' + $target.Name) -or $c.Image -ne $image -or
        $c.Config.Labels.'com.focusstore.disposable.owner' -ne 'focusstore-postgres-test' -or
        $c.Config.Labels.'com.focusstore.disposable.run' -ne $target.Run -or $c.State.Status -ne $expectedState) {
        throw 'Container identity or state mismatch.'
    }
    $binding = @($c.HostConfig.PortBindings.'5432/tcp')
    $networks = @($c.NetworkSettings.Networks.PSObject.Properties | ForEach-Object { $_.Name })
    if ($c.HostConfig.NetworkMode -ne 'bridge' -or @($c.HostConfig.PortBindings.PSObject.Properties).Count -ne 1 -or $binding.Count -ne 1 -or
        $binding[0].HostIp -ne '127.0.0.1' -or $binding[0].HostPort -ne '55432' -or
        @($networks | Where-Object { $_ -ne 'bridge' }).Count -ne 0 -or ($expectedState -eq 'running' -and $networks.Count -ne 1) -or
        $c.HostConfig.PublishAllPorts -or $c.HostConfig.Privileged) { throw 'Unexpected network or privileges.' }
    if ($null -eq $c.HostConfig -or $null -eq $c.Mounts -or $null -eq $c.HostConfig.Tmpfs -or
        @($c.HostConfig.Tmpfs.PSObject.Properties).Count -ne 1 -or
        $c.HostConfig.Tmpfs.'/var/lib/postgresql' -ne 'rw,nosuid,nodev,mode=0700' -or
        @($c.HostConfig.Binds | Where-Object { $null -ne $_ }).Count -ne 0 -or
        @($c.HostConfig.Mounts | Where-Object { $null -ne $_ }).Count -ne 0 -or
        @($c.Mounts | Where-Object { $_.Type -ne 'tmpfs' -or $_.Destination -ne '/var/lib/postgresql' }).Count -ne 0) {
        throw 'Persistent or bind mount detected.'
    }
}

foreach ($target in $targets | Where-Object { $_.Id -eq $ContainerId }) {
    $expectedState = if ($StopContainer) { 'running' } elseif ($Remove) { 'exited' } elseif ($target.Id -eq 'd0a67cee8cf8611eeffd8836ba01625803affd01ac3e6919948188245e0f667b') { 'running' } else { 'exited' }
    Assert-Target $target $expectedState
    Write-Output ("Verified: " + $target.Id + ' (original ownership token unavailable).')
    if ($Remove -and $PSCmdlet.ShouldProcess($target.Id, 'Remove verified stopped container')) {
        Assert-Target $target 'exited'
        & $docker --context desktop-linux rm $target.Id
        if ($LASTEXITCODE -ne 0) { throw 'Container removal failed; inspect manually.' }
    }
    if ($StopContainer -and $PSCmdlet.ShouldProcess($target.Id, 'Stop verified container')) {
        Assert-Target $target 'running'
        & $docker --context desktop-linux stop --timeout 10 $target.Id
        if ($LASTEXITCODE -ne 0) { throw 'Container stop failed; inspect manually.' }
    }
}
