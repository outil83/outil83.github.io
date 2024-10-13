# RUN BELOW COMMANT TO INSTALL APACHE2

sudo apt-get install apache2

# RUN BELOW COMMAND TO ENABLE MODULES
sudo a2enmod

# WHEN PROMPTED COPY PASTE BELOW
proxy proxy_ajp proxy_http rewrite deflate headers proxy_balancer proxy_connect proxy_html

# RUN BELOW COMMANT TO COPY FILES
sudo cp ~/apache2-setup/ports.conf /etc/apache2/ports.conf

sudo cp ~/apache2-setup/000-default.conf /etc/apache2/sites-available/000-default.conf


