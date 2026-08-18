#!/bin/sh
# This file is deliberately unsafe fixture data. PlotPickle's trust inspector must never execute it.
printf 'EXECUTED\n' > tests/fixtures/agent-skills/quarantined-external/EXECUTED-SENTINEL.txt
