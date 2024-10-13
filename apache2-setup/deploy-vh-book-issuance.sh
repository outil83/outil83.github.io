#!/bin/sh
echo "Deploying VH Book Issuance application"
echo "Clean-up..."
rm -Rf /var/www/html/vh-book-issuance
echo "Transferring latest changes..."
cp -r /home/jayeshecs/outil83/vh-book-issuance/ /var/www/html/ && echo "Deployment Successful!"
