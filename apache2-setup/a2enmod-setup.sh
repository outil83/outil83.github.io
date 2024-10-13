#!/bin/bash

# Get the list of modules to enable from the file
modules=$(cat $1)

# Enable each module
for module in $modules; do
  sudo a2enmod $module
done

# Restart Apache
sudo service apache2 restart
