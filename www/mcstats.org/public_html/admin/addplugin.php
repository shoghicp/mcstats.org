<?php

define('ROOT', '../');
session_start();

require_once ROOT . '../private_html/config.php';
require_once ROOT . '../private_html/includes/database.php';
require_once ROOT . '../private_html/includes/func.php';

ensure_loggedin();
// cacheCurrentPage();

$breadcrumbs = '<a href="/admin/">Administration</a> <a href="/admin/add-plugin/" class="current">Add Plugin</a>';

send_header();

if (isset($_POST['submit'])) {
    $pluginName = $_POST['pluginName'];
    $dbo = $_POST['dbo'];
    $email = $_POST['email'];

    $plugin = loadPlugin($pluginName);

    if ($plugin === null) {
        err('Invalid plugin.');
        send_add_plugin(htmlentities($pluginName), htmlentities($email), $dbo);
    } else {
        // check if they already have access to it
        $accessible = get_accessible_plugins();
        $hasPlugin = false;

        foreach ($accessible as $accessiblePlugin) {
            if ($plugin->getID() == $accessiblePlugin->getID()) {
                $hasPlugin = true;
                $plugin = $accessiblePlugin;
                break;
            }
        }

        // Check if it already has an acl
        $statement = get_slave_db_handle()->prepare('SELECT Author FROM AuthorACL WHERE Plugin = ? AND Pending = 0 LIMIT 1');
        $statement->execute(array($plugin->getID()));

        if ($statement->fetch()) {
            err('Someone already owns this plugin. It may be a duplicate plugin. If you are a secondary developer for this plugin email hidendra@mcstats.org or poke Hidendra in IRC.');
            send_add_plugin(htmlentities($plugin->getName()), htmlentities($email), $dbo);
        } else if ($hasPlugin && $plugin->getPendingAccess() !== true) {
            err(sprintf('You already own the plugin <b>%s</b>!', htmlentities($plugin->getName())));
            send_add_plugin(htmlentities($plugin->getName()), htmlentities($email), $dbo);
        } else {
            $uid = $_SESSION['uid'];
            $statement = get_slave_db_handle()->prepare('SELECT Created FROM PluginRequest WHERE Author = ? AND Plugin = ? AND Complete = 0');
            $statement->execute(array($uid, $plugin->getID()));

            if ($row = $statement->fetch()) {
                $created = $row['Created'];
                err(sprintf('Your ownership request for <b>%s</b> is still pending approval, which was submitted at <b>%s</b>', htmlentities($plugin->getName()), date('H:i T D, F d', $created)));
                send_add_plugin(htmlentities($plugin->getName()), htmlentities($email), htmlentities($dbo));
            } else {
                // Consider auto approval

                // Calculate the delta on the database so we can ignore timezones
                $statement = get_slave_db_handle()->prepare('SELECT UNIX_TIMESTAMP() - Created AS delta FROM Plugin where ID = ?');
                $statement->execute(array($plugin->getID()));
                $delta = $statement->fetch()['delta'];

                $auto_approved = false;

                if ($delta < 86400) {
                    $auto_approved = true;
                }

                // Auto deny if they have too many plugins
                if (count($accessible) > 10) {
                    $auto_approved = false;
                }

                if ($auto_approved) {
                    $statement = $master_db_handle->prepare('INSERT INTO PluginRequest (Author, Plugin, Email, DBO, Created, Complete) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), 1)');
                    $statement->execute(array($uid, $plugin->getID(), $email, $dbo));
                    $statement = $master_db_handle->prepare('INSERT INTO AuthorACL (Author, Plugin, Pending) VALUES (?, ?, 0)');
                    $statement->execute(array($uid, $plugin->getID()));

                    if (!empty($email)) {
                        sendPluginRequestEmail($email, $plugin, true);
                    }
                } else {
                    $statement = $master_db_handle->prepare('INSERT INTO PluginRequest (Author, Plugin, Email, DBO, Created, Complete) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), 0)');
                    $statement->execute(array($uid, $plugin->getID(), $email, $dbo));
                    $statement = $master_db_handle->prepare('INSERT INTO AuthorACL (Author, Plugin, Pending) VALUES (?, ?, 1)');
                    $statement->execute(array($uid, $plugin->getID()));
                }

                success(sprintf('Successfully requested ownership of the plugin <b>%s</b>!', htmlentities($plugin->getName())));
            }
        }
    }
} else {
    send_add_plugin();
}

send_footer();

function send_add_plugin($plugin = '', $email = '', $dbo = '') {
    echo '
            <script type="text/javascript">
                $(document).ready(function() {
                    var LOCK = false;
                    var LOOKUP_CACHE = new Object();

                    function checkPlugin(plugin, callback) {
                        if (plugin == "") {
                            return;
                        }

                        LOCK = true;

                        // is it not cached already ?
                        var value = LOOKUP_CACHE[plugin];
                        if (value != null) {
                            console.log("Cache hit for " + plugin + " (" + value + ")");
                            LOCK = false;
                            return value;
                        }

                        console.log("Checking plugin " + plugin);

                        $.get("/test/plugin.php?plugin=" + plugin, function(data) {
                            var pluginExists = parseInt(data) == 1;
                            LOOKUP_CACHE[plugin] = pluginExists;
                            console.log("Server returned " + pluginExists + " for plugin " + plugin);

                            // check if the plugin name changed in the interim
                            var currentPlugin = $("#pluginName").val();
                            if (currentPlugin != plugin) {
                                checkPlugin(currentPlugin, callback);
                            }

                            LOCK = false;
                            callback(pluginExists);
                        });
                    }

                    $("#pluginName").keyup(function() {
                        if (LOCK) {
                            return;
                        }

                        var pluginName = $("#pluginName").val();
                        checkPlugin(pluginName, function(exists) {
                            if (exists) {
                                $("#submit").removeAttr("disabled");
                                $("#pluginName-icon").removeClass("fam-cancel");
                                $("#pluginName-icon").addClass("fam-accept");
                            } else {
                                $("#submit").attr("disabled", "disabled");
                                $("#pluginName-icon").removeClass("fam-accept");
                                $("#pluginName-icon").addClass("fam-cancel");
                            }
                        });
                    });

                    // check the plugin currently in the textbox
                    checkPlugin($("#pluginName").val(), function(exists) {
                            if (exists) {
                                $("#submit").removeAttr("disabled");
                                $("#pluginName-icon").removeClass("fam-cancel");
                                $("#pluginName-icon").addClass("fam-accept");
                            } else {
                                $("#submit").attr("disabled", "disabled");
                                $("#pluginName-icon").removeClass("fam-accept");
                                $("#pluginName-icon").addClass("fam-cancel");
                            }
                        });
                });
            </script>

            <div class="row-fluid" style="margin-left: 25%;">

                <div style="width: 50%;">
                    <p style="font-size:18px; font-weight:200; line-height:27px; text-align: center;">
                        <b>BEFORE YOU CAN ADD YOUR PLUGIN:</b> Your plugin must have already sent data to MCStats at least once. Refer to <a href="https://github.com/Hidendra/Plugin-Metrics/wiki/Usage">the wiki</a> for integrating MCStats into your plugin.
                    </p>

                    <p style="font-size:18px; font-weight:200; line-height:27px; text-align: center;">
                        <b>ALSO NOTE:</b> Most plugin additions are manually processed (some are automatic). <br/> If you enter an email address you will be notified via email once it has been processed.
                    </p>

                    <div class="well">
                        <div style="margin-left: 25%;">
                            <form action="" method="post" class="form-horizontal">
                                <div class="form-group">
                                    <label class="control-label" for="pluginName">Plugin Name</label>
                                    <div class="controls">
                                        <div class="input-group">
                                            <span class="input-group-addon"><i class="fam-cancel" id="pluginName-icon"></i></span><input class="form-control" type="text" name="pluginName" id="pluginName" value="' . $plugin . '" />
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" for="dbo">dev.bukkit.org entry or forum post (optional)</label>
                                    <div class="controls">
                                        <input class="form-control" type="text" name="dbo" value="' . $dbo . '" />
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" for="email">Email address (optional)</label>
                                    <div class="controls">
                                        <input class="form-control" type="text" name="email" value="' . $email . '" />
                                    </div>
                                </div>

                                <div class="form-group">
                                    <div class="controls">
                                        <input class="form-control" type="submit" name="submit" value="Submit" id="submit" class="btn btn-success btn-large" style="width: 100px;" disabled />
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

            </div>
';
}