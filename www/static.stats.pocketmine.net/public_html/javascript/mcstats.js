$(document).ready(function () {
    // Hide the servers that are waiting to be hidden
    $(".hide-server").hide();

    // listen for graph generator updates
    setInterval(function () {
        $.get('/graph-generator.php', function (data) {
            var graphPercent = parseInt(data);

            // nothing generating
            if (graphPercent == 0) {
                $("#graph-generator").hide();
            }

            // graphs generating
            else {
                $("#graph-generator-progress-bar").width(graphPercent + "%");
                $("#graph-generator").show();
            }
        });
    }, 10000);
});

// typeahead
$(document).ready(function() {

    $("#goto").typeahead({
        name: 'Plugin',
        remote: 'http://api.stats.pocketmine.net/1.0/typeahead/?q=%QUERY'
    });

    $("#goto").bind("typeahead:selected", function(obj, datum) {
        window.location = "/plugin/" + datum.value;
    });


    $(".sparkline_line_good span").sparkline("html", {
        type: "line",
        fillColor: "#B1FFA9",
        lineColor: "#459D1C",
        width: "50",
        height: "24"
    });
    $(".sparkline_line_bad span").sparkline("html", {
        type: "line",
        fillColor: "#FFC4C7",
        lineColor: "#BA1E20",
        width: "50",
        height: "24"
    });
    $(".sparkline_line_neutral span").sparkline("html", {
        type: "line",
        fillColor: "#CCCCCC",
        lineColor: "#757575",
        width: "50",
        height: "24"
    });

    $(".sparkline_bar_good span").sparkline('html',{
        type: "bar",
        barColor: "#459D1C",
        barWidth: "5",
        height: "24"
    });
    $(".sparkline_bar_bad span").sparkline('html',{
        type: "bar",
        barColor: "#BA1E20",
        barWidth: "5",
        height: "24"
    });
    $(".sparkline_bar_neutral span").sparkline('html',{
        type: "bar",
        barColor: "#757575",
        barWidth: "5",
        height: "24"
    });
});

// plugin list vars
var pluginListPage = 1;
var pluginListMaxPages = 1;

/**
 * Load a page in the plugin list
 * @param page
 */
function loadPluginListPage(page) {
    if (page < 1) {
        return;
    }

    loadMaxPagesFromHTML();

    if (page > pluginListMaxPages) {
        page = pluginListMaxPages;
    }

    // disable the plugin buttons before sending data
    $("#plugin-list-back").addClass("disabled");
    $("#plugin-list-forward").addClass("disabled");
    $("#plugin-list-go").addClass("disabled");

    // load the json data
    $.getJSON("http://api.stats.pocketmine.net/1.0/list/" + page, function (data) {
        // var to the store the html in
        var html = "";

        for (i = 0; i < data.plugins.length; i++) {
            var plugin = data.plugins[i];
            var rank = plugin.rank;
            var linkName = plugin.name;

            if (rank <= 10) {
                rank = "<b>" + rank + "</b>";
                plugin.name = "<b>" + plugin.name + "</b>";
                plugin.servers24 = "<b>" + plugin.servers24 + "</b>";
            }

            // increase
            if (plugin.rank < plugin.lastrank) {
                rank += ' <i class="fam-arrow-up" title="Increased from ' + plugin.lastrank + ' (+' + (plugin.lastrank - plugin.rank) + ')"></i>';
            }

            // decrease
            else if (plugin.rank > plugin.lastrank) {
                rank += ' <i class="fam-arrow-down" title="Decreased from ' + plugin.lastrank + ' (-' + (plugin.rank - plugin.lastrank) + ')"></i>';
            }

            // no change
            else {
                rank += ' <i class="fam-bullet-blue" title="No change"></i>';
            }

            html += '<tr id="plugin-list-item"> <td style="text-align: center;">' + rank + ' </td> <td> <a href="/plugin/' + linkName + '" target="_blank">' + plugin.name + '</a> </td> <td style="text-align: center;"> ' + plugin.servers24 + ' </td> </tr>';
        }

        // clear out the old plugins in the table
        clearPluginList();

        // add it to the table
        $("#plugin-list tr:first").after(html);

        // loaded !
        pluginListPage = page;

        // update page number displays
        $("#plugin-list-current-page").html(page);
        $("#plugin-list-max-pages").html(data.maxPages);
        $("#plugin-list-goto-page").val(page);

        // re-enable the plugin buttons
        $("#plugin-list-back").removeClass("disabled");
        $("#plugin-list-forward").removeClass("disabled");
        $("#plugin-list-go").removeClass("disabled");

        // show/hide the back button as necessary
        if (pluginListPage == 1) {
            $("#plugin-list-back").hide();
        } else {
            $("#plugin-list-back").show();
        }

        // and the forward button
        if (pluginListPage == pluginListMaxPages) {
            $("#plugin-list-forward").hide();
        } else {
            $("#plugin-list-forward").show();
        }

        // change the URL
        history.pushState(null, "Plugin Metrics :: Page " + page, "/plugin-list/" + page + "/");
    });

}

/**
 * Clear the plugin list
 */
function clearPluginList() {
    $("#plugin-list #plugin-list-item").remove();
}

/**
 * Move the plugin list backwards
 */
function movePluginListBack() {
    loadCurrentPageFromHTML();

    if (pluginListPage == 1) {
        return;
    }

    loadPluginListPage(pluginListPage - 1);
}

/**
 * Move the plugin list forwards
 */
function movePluginListForward() {
    loadCurrentPageFromHTML();

    // go to the next page
    loadPluginListPage(pluginListPage + 1);
}

function loadMaxPagesFromHTML() {
    var maxPageHTML = parseInt($("#plugin-list-max-pages").html());

    if (maxPageHTML > 0) {
        pluginListMaxPages = maxPageHTML;
    }
}

/**
 * attempt to load the current page from the html
 */
function loadCurrentPageFromHTML() {
    var currentPageHTML = parseInt($("#plugin-list-current-page").html());

    if (currentPageHTML > 0) {
        pluginListPage = currentPageHTML;
    }
}

/**
 * Show all of the hidden servers (mainly used on the index page)
 */
function showMoreServers() {
    // Hide the show more link
    $(".more-servers").hide();

    // Show the servers
    $(".hide-server").show();
}

var HIGHCHARTS = "highcharts";
var HIGHSTOCKS = "highstocks";

/**
 * Retrieve graph data for a given options object and then regenerate the graph.
 *
 * @param options
 * @param framework
 * @param feedurl
 */
function retrieveGraphData(options, framework, feedurl) {
    $.getJSON(feedurl, function (json) {
        // if the graph is a simple pie graph we've got our work cut out for us
        if (json.type == "Pie") {
            options.series = [
                {
                    name: "",
                    data: json.data
                }
            ];
        }

        else if (json.type == "Map") {
            var renderTo = options.chart.renderTo;
            var googOptions = {
                backgroundColor: {
                    fill: 'transparent'
                }
            };

            var chart = new google.visualization.GeoChart(document.getElementById(renderTo));
            chart.draw(google.visualization.arrayToDataTable(json.data), googOptions);
        }

        else if (json.type == "Donut") {
            var colors = [ "#4572A7", "#AA4643", "#89A54E", "#80699B", "#3D96AE", "#DB843D", "#92A8CD", "#A47D7C", "#B5CA92" ]; // Highcharts.getOptions().colors;
            var inner = [];
            var outer = [];
            var colorIndex = 0;

            for (outName in json.data) {
                var sum = 0;
                var length = 0;

                for (oin in json.data[outName]) {
                    length++;
                }

                var j = 0;
                for (oin in json.data[outName]) {
                    var inobject = json.data[outName][oin];
                    var brightness = 0.2 - (j / length) / 5;
                    sum += inobject.y;

                    outer.push({
                        name: inobject.name,
                        y: inobject.y,
                        color: Highcharts.Color(colors[colorIndex]).brighten(brightness).get()
                    });
                    j++;
                }

                inner.push({
                    name: outName,
                    y: sum,
                    color: colors[colorIndex]
                });

                colorIndex++;
            }

            options.series = [
                {
                    name: '',
                    data: inner,
                    size: '60%',
                    dataLabels: {
                        formatter: function () {
                            return this.y > 5 ? this.point.name : null;
                        },
                        color: 'white',
                        distance: -30
                    }
                },
                {
                    name: '',
                    data: outer,
                    innerSize: '60%',
                    dataLabels: {
                        formatter: function () {
                            // display only if larger than 1
                            return this.y > 1 ? '<b>' + this.point.name + ':</b> ' + this.y + '%' : null;
                        }
                    }
                }
            ];
        }

        // bit lengthier, we need to generate each column
        else {
            // init the array
            options.series = [];

            // go through each column
            for (columnName in json.data) {
                options.series.push({
                    name: columnName,
                    data: json.data[columnName]
                });
            }
        }

        if (options.chart.type != "map") {
            // now regenerate the graph
            if (framework == HIGHSTOCKS) {
                new Highcharts.StockChart(options);
            } else {
                new Highcharts.Chart(options);
            }
        }
    });

}