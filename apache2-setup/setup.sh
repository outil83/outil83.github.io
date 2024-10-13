#/bin/bash

sudo apt-get update

sudo apt-get -y install apache2

sudo service apache2 start

# RUN BELOW COMMAND TO ENABLE MODULES
sudo ./a2enmod-setup.sh modules.txt

# WHEN PROMPTED COPY PASTE BELOW
#proxy proxy_ajp proxy_http rewrite deflate headers proxy_balancer proxy_connect proxy_html

# RUN BELOW COMMANT TO COPY FILES
sudo cp ./ports.conf /etc/apache2/ports.conf

sudo cp ./000-default.conf /etc/apache2/sites-available/000-default.conf

sudo service apache2 restart
