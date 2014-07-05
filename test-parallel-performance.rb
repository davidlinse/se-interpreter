#!/bin/env ruby

require 'pp'

instances = ARGV[0] #1
runs = ARGV[1]      #1

tests = "./local.json " * instances
tests = "./examples/tests/full_example.json " * instances

node_cmd =
"node interpreter.js --quiet --noPrint --silent \
--driver-host=127.0.0.1 --driver-port=4444 \
--browser-browserName=chrome \
--parallel=#{instances} \
#{tests}"

secs = [];

runs.times do |n|

    # puts "Run ##{n+1} with #{instances} interpreter instance(s) "
    # puts "#{node_cmd}"
    # r = `(TIMEFORMAT=%R; time sleep #{instances}) 2>&1` # | awk '{print $2}'`

    r = `(TIMEFORMAT=%R; time #{node_cmd}) 2>&1`

    r.chomp!
    secs.push(r.to_f)

    puts "#{r} "

    # be gentle to the system
    sleep 1
end

total = secs.reduce(:+)

puts "\nTotal time: #{total} .."

