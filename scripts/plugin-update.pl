#!/usr/bin/env perl
use 5.014;
use strict;
use warnings;
use Fcntl qw(LOCK_EX LOCK_NB F_SETFD);
use File::Path qw(make_path);
use File::Temp qw(tempfile);
use JSON::PP qw(decode_json);
use POSIX qw(setpgid WNOHANG _exit);
use Time::HiRes qw(clock_gettime CLOCK_MONOTONIC sleep);

@ARGV == 1 && $ARGV[0] =~ /^[1-9][0-9]*$/ or die "plugin-update: expected the runner PID\n";
my $runner = $ARGV[0];
my $deadline = clock_gettime(CLOCK_MONOTONIC) + 120;
my $config = $ENV{CLAUDE_CONFIG_DIR} || "$ENV{HOME}/.claude";
my ($log) = tempfile(UNLINK => 1);
my ($stdout) = tempfile(UNLINK => 1);
my ($child, $interrupted);
my $phase = 'wait for the plugin update lock';
for my $signal (qw(INT TERM HUP)) {
    $SIG{$signal} = sub { $interrupted = $signal };
}

sub stop_child {
    return unless defined $child;
    sleep 1 if kill 'TERM', -$child;
    kill 'KILL', -$child;
    waitpid($child, 0);
    undef $child;
}

sub fail {
    my ($message) = @_;
    stop_child();
    print STDERR "plugin-update: $message\n";
    seek($log, 0, 0) or die "plugin-update: cannot read command output: $!\n";
    local $/;
    print STDERR <$log> // '';
    seek($stdout, 0, 0) or die "plugin-update: cannot read stdout: $!\n";
    print STDERR <$stdout> // '';
    exit 1;
}

sub check {
    fail("interrupted by SIG$interrupted during $phase") if $interrupted;
    fail("the runner exited during $phase") unless kill 0, $runner;
    fail("timed out after 120 seconds during $phase") if clock_gettime(CLOCK_MONOTONIC) >= $deadline;
}

make_path($config);
open my $lock, '>>', "$config/celetis-update.lock" or fail("cannot open the plugin update lock: $!");
# A command keeps the lock if its supervisor is killed before the command stops.
fcntl($lock, F_SETFD, 0) or fail("cannot keep the plugin update lock in child processes: $!");
until (flock($lock, LOCK_EX | LOCK_NB)) {
    fail("cannot acquire the plugin update lock: $!") unless $!{EWOULDBLOCK} || $!{EAGAIN} || $!{EINTR};
    check();
    sleep 0.05;
}

my $output;
for my $command (
    ['claude', 'plugin', 'marketplace', 'update', 'celetis'],
    ['claude', 'plugin', 'update', 'celetis@celetis', '--scope', 'user'],
    ['claude', 'plugin', 'list', '--json'],
) {
    $phase = join ' ', @$command;
    check();
    seek($log, 0, 0) && truncate($log, 0) or fail("cannot reset command output: $!");
    seek($stdout, 0, 0) && truncate($stdout, 0) or fail("cannot reset stdout: $!");
    $child = fork();
    fail("cannot start $phase: $!") unless defined $child;
    if ($child == 0) {
        $SIG{$_} = 'DEFAULT' for qw(INT TERM HUP);
        setpgid(0, 0) == 0 or die "plugin-update: cannot make a command process group: $!\n";
        open STDIN, '<', '/dev/null' or die "plugin-update: cannot close command input: $!\n";
        open STDOUT, '>&', $stdout or die "plugin-update: cannot capture stdout: $!\n";
        open STDERR, '>&', $log or die "plugin-update: cannot capture stderr: $!\n";
        exec { $command->[0] } @$command or do {
            print STDERR "plugin-update: cannot run $phase: $!\n";
            _exit(127);
        };
    }
    setpgid($child, $child);
    while (1) {
        check();
        my $done = waitpid($child, WNOHANG);
        if ($done == $child) {
            my $status = $?;
            my $code = $status & 127 ? 128 + ($status & 127) : $status >> 8;
            fail("$phase failed (exit $code)") if $code;
            stop_child();
            last;
        }
        fail("cannot wait for $phase: $!") if $done == -1;
        sleep 0.05;
    }
    seek($stdout, 0, 0) or fail("cannot read command output: $!");
    local $/;
    $output = <$stdout> // '';
}
check();
my $records = eval { decode_json($output) };
fail("invalid plugin list JSON: $@") if $@;
ref($records) eq 'ARRAY' or fail('the plugin list is not an array');
my @user = grep { ref($_) eq 'HASH' && ($_->{id} // '') eq 'celetis@celetis' && ($_->{scope} // '') eq 'user' } @$records;
@user == 1 or fail('expected one user installation of celetis@celetis');
my $path = $user[0]{installPath};
defined($path) && !ref($path) && length($path) or fail('the user installation has no installPath');
utf8::encode($path);
-f "$path/step-prompt.md" or fail("the installed folder has no step-prompt.md: $path");
print "$path\n";
