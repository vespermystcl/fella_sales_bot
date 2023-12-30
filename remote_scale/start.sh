#!/bin/bash

heroku ps:scale worker=1 -a mystclsalesbot

## Start
# ./start.sh

## Check live logs
# heroku logs --tail -a mystclsalesbot