# Configuring Apache To Serve Notes Together

1. [optional] Set a DNS A record for a new domain name, if Notes Together will appear as a different host than other websites served by Apache.
2. Ensure your TLS certificate includes the domain name Notes Together be will visible as.
3. Create the directory where the files will be stored, such as `/var/www/notestogether`
4. [optional] Set up a name-based virtual server, if Notes Together will appear as a different host than other websites served by Apache.
5. Configure Apache.  A name-based virtual server will resemble:
```
<VirtualHost *:443>
ServerName notestogether.example.com
DocumentRoot /var/www/notestogether
SSLEngine on
#SSLCipherSuite EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH
#SSLHonorCipherOrder on
#SSLProtocol All -SSLv2 -SSLv3

# HSTS (mod_headers is required) (15768000 seconds = 6 months)
Header      always set Strict-Transport-Security "max-age=31536000"

ErrorLog   ${APACHE_LOG_DIR}/error.log
#ErrorLog logs/serenenotes_error_log
#TransferLog logs/serenenotes_access_log
CustomLog ${APACHE_LOG_DIR}/access.log combined
#LogLevel warn
SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem
Include /etc/letsencrypt/options-ssl-apache.conf
Header always set Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https:; object-src 'none'; child-src 'none'; frame-ancestors 'none'; form-action 'none';"
Header always set Referrer-Policy 'no-referrer'
</VirtualHost>                                  

```

5. Search the **other** configuration files for Apache for lines containing `Alias`, to ensure that the directory `/icons/` isn't aliased to something else.


