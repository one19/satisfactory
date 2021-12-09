# SATISFACTORY DEDICATED SERVER INFRA

This'll launch a server that'll play satisfactory.

So all the infra information will exist in this repo. should contain all the stuff we need:

<!-- 1. elastic ip or reserve a public ip/url for our dedicated server -->
<!-- 2. either an ECS instance that we SSH into to do snowflakey stuff like setting `systemctl` startup tasks, or a docker image -->
3. a serverless function to trigger scaling our docker image or ec2 server up
4. something to scale our server down to dead when nobody is on
5. volume storage for our save so we don't lose it on server crash
6. make sure the server is beefy enough
