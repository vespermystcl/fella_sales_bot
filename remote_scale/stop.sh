#!/bin/bash

heroku ps:scale worker=0 -a mystclsalesbot

## Stop
# ./stop.sh

## Check live logs
# heroku logs --tail -a mystclsalesbot