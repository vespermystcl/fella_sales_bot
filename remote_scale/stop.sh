#!/bin/bash

heroku ps:scale web=0 -a mystclsalesbot

## Stop
# ./stop.sh

## Check live logs
# heroku logs --tail -a mystclsalesbot