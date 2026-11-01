#!/usr/bin/env perl
# report.pl - summarize daily order logs into a revenue report.
use strict;
use warnings;
use utf8;
use POSIX qw(strftime);
use List::Util qw(sum0 max);

our $VERSION = '1.2.0';
use constant {
    TAX_RATE      => 0.0825,
    LARGE_ORDER   => 500,
    MAX_SKUS_SHOWN => 0x0A,
};

my %revenue_by_sku;
my %count_by_status = (paid => 0, shipped => 0, cancelled => 0);
my @errors;

=head2 parse_line

Parses one log line like C<2026-10-31T12:00:00Z ORD-00001042 paid TEA-00042 x2 @18.50>.

=cut

sub parse_line {
    my ($line) = @_;
    return unless $line =~ m{
        ^(\S+) \s+ (ORD-\d{8}) \s+ (\w+) \s+ ([A-Z]{3}-\d{5}) \s+ x(\d+) \s+ \@([\d.]+)$
    }x;
    return { ts => $1, ref => $2, status => lc $3, sku => $4, qty => $5, price => $6 };
}

while (my $line = <STDIN>) {
    chomp $line;
    next if $line =~ /^\s*(#|$)/;    # skip comments and blank lines
    my $rec = parse_line($line) or do { push @errors, "line $.: $line"; next };

    $count_by_status{ $rec->{status} }++;
    next if $rec->{status} eq 'cancelled';
    $revenue_by_sku{ $rec->{sku} } += $rec->{qty} * $rec->{price};
}

# FIXME: amounts are floats; switch to integer cents before the audit
my $gross = sum0 values %revenue_by_sku;
my $net   = $gross / (1 + TAX_RATE);
my $date  = strftime('%Y-%m-%d', localtime);
(my $host = `hostname`) =~ s/\s+$//;

print <<"END_REPORT";
Daily revenue report \x{2014} $date (host: $host)
===========================================
Gross: \$@{[ sprintf '%.2f', $gross ]}
Net:   \$@{[ sprintf '%.2f', $net ]}
Paid: $count_by_status{paid}   Shipped: $count_by_status{shipped}
END_REPORT

my @top = (sort { $revenue_by_sku{$b} <=> $revenue_by_sku{$a} } keys %revenue_by_sku);
for my $sku (@top[0 .. max(0, $#top < MAX_SKUS_SHOWN - 1 ? $#top : MAX_SKUS_SHOWN - 1)]) {
    next unless defined $sku;
    (my $label = $sku) =~ s/-0+/-/g;
    my $flag = $revenue_by_sku{$sku} > LARGE_ORDER ? '*' : ' ';
    printf "%s %-10s %10.2f\n", $flag, $label, $revenue_by_sku{$sku};
}

warn sprintf("%d unparseable line(s)\n", scalar @errors) if @errors;
exit(@errors ? 1 : 0);
