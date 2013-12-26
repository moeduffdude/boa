var http = require ("http");
var path = require ("path");
var fs = require ("fs");

var cookie = require ("cookie");
var connect = require ("connect");
var pg = require ("pg");

var crypto = require (path.join (__dirname, "/lib/cyper"));
var qJSON = require (path.join (__dirname, "/lib/qJSON"));

var session = {
    key:    'BOA',
    cookie: {
        maxAge:     259200000,
        secure:     false
    }
};



var cache = {};
// this holds the data to be returned on those marvelous requests
var JSON = {};
var port = process.env.PORT || 8888;
var pg_connection = process.env.DATABASE_URL || "tcp://postgres:password@127.0.0.1:5432/boa";
var pg_client = new pg.Client (pg_connection);



/// adding a couple more of MIME's on the compression list of connect...
/// @param {Object} request
/// @param {Object} response
function filter (request, response) {
    var type = response.getHeader ('Content-Type') || "";
    return type.match (/plain|image|html|css|javascript|json|ttf/);
}



var app = connect();
app.use (connect.compress ({
	filter:	filter
}));
app.use (connect.favicon (path.join (__dirname, "assets/image/node.png")));
app.use (connect.logger ("dev"));
app.use (connect.query());
app.use (connect.bodyParser());
app.use (connect.cookieParser ('$^&*GHDW@#D$AP78|=)27tBse!23VFUZ#z!XCE~!$}*FSHI-FBDs36fg6f@{9X$}'));
app.use (connect.session (session));
app.use (connect.csrf());
app.use (connect.errorHandler());
app.use ("/static", connect.static (path.join (__dirname, "assets")));
app.use ("/templates", connect.static (path.join (__dirname, "templates")));

app.use ("/login", login);
app.use ("/signup", signup);
app.use ("/REST", rest);
app.use (home);



var server = http.createServer (app).listen (port, function () {
    console.log ("Server listening @ %d", port);

    pg_client.connect (function (error) {
        // if there's an error connecting to the database server we'll be killing the whole thing!
        if (error) {
            console.error ('Dude, i was unable to connect to DB.\n', error);
            process.exit (1);
        }

        else {
			pg_client.query ('CREATE TABLE IF NOT EXISTS users (id serial NOT NULL, username character varying(128), "password" character varying(128) NOT NULL, email character varying(128) NOT NULL, super_duper boolean NOT NULL DEFAULT false, CONSTRAINT user_pkey PRIMARY KEY (id), CONSTRAINT user_username_key UNIQUE (username));', function (error, result) {
				if (error) {
                    console.log (error);
                }

				else {
					pg_client.query ('CREATE TABLE IF NOT EXISTS branch (id serial NOT NULL, branch_name character varying(192) NOT NULL, service_type character varying(32) NOT NULL, speed character varying(32), access_type character varying(32) NOT NULL, service_no bigint NOT NULL, ip_address character varying(16) NOT NULL, CONSTRAINT branch_pkey PRIMARY KEY (id));', function (error, result) {
						if (error) {
							console.log (error);
						}

						else {
							pg_client.query ('CREATE TABLE IF NOT EXISTS report (id serial NOT NULL, reported_by integer, ts timestamp with time zone NOT NULL DEFAULT now(), ticket_no character varying(128) NOT NULL, status character varying(64) NOT NULL, branch integer, ts_close timestamp with time zone DEFAULT now(), CONSTRAINT report_pkey PRIMARY KEY (id), CONSTRAINT "user" FOREIGN KEY (reported_by) REFERENCES users (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION, CONSTRAINT report_ticket_no_key UNIQUE (ticket_no));', function (error, result) {
								if (error) {
									console.log (error);
								}

								else {
									pg_client.query ('CREATE TABLE IF NOT EXISTS log (id serial NOT NULL, "user" integer NOT NULL, log character varying(256), ts timestamp with time zone DEFAULT now(), CONSTRAINT pk_log PRIMARY KEY (id), CONSTRAINT fk_user FOREIGN KEY ("user") REFERENCES users (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION);', function (error, result) {
										if (error) {
											console.log (error);
										}

										else {
											pg_client.query ('INSERT INTO users (username, "password", email, super_duper) VALUES ($1, $2, $3, $4);', ["moe", "45217af896b912029728c16ca5c77688a8967ca70e594470a5f10ee8015436cf59d65761acaa0adeb4d5b6c3bfd5cfa3b49e5ac749c0e451119853c641afe026", "moe.duffdude@gmail.com", true], function (error, result) {
												if (error) {
													console.log (error);
												}

												// this is where the branches are added for the first time
												else {
													
												}
											});
										}
									});
								}
							});
						}
					});
				}
			});
        }
    });
});



/// adding a couple more of MIME's on the compression list of connect...
/// @param {Object} request
/// @param {Object} response
function home (request, response) {
    // if we cached it already - there won't be a need to read from DISK - which we all know for being FAST!
    if (cache.body !== undefined) {
        response.setHeader ('Content-Type', 'text/html');
        response.setHeader ('Content-Length', Buffer.byteLength (cache.body + "<input type='hidden' id='csrf' name='_csrf' value='" + request.csrfToken() + "' />"));
        response.end (cache.body + "<input type='hidden' id='csrf' name='_csrf' value='" + request.csrfToken() + "' />");
    }

    else {
        var body = fs.readFileSync (path.join (__dirname, "/templates/index.html"), {
            encoding:   "utf-8",
            flag:       "r"
        });

        response.setHeader ('Content-Type', 'text/html');
        response.setHeader ('Content-Length', Buffer.byteLength (body + "<input type='hidden' id='csrf' name='_csrf' value='" + request.csrfToken() + "' />"));
        response.end(body + "<input type='hidden' id='csrf' name='_csrf' value='" + request.csrfToken() + "' />");
        // we'll be caching only the body --- the csrf will be unique for ERY request, well duh it's CSRF!
        cache.body = body;
    }
}



function login (request, response) {
	pg_client.query ("SELECT id, username, email, super_duper FROM users WHERE username=$1 AND password=$2", [request.body.username, crypto.sha512 (request.body.password)], function (error, result) {
		if (error) {
			JSON = {
				success:    false,
				code:       "DB_ERROR",
				message:    "Something HORRIBLE went wrong :("
			};
		}

		else {
			if (result.rowCount === 1) {
				JSON = {
					success:    true,
					code:       "WHITE_MAN",
					user:		result.rows[0]
				};

				// storing credentials in session `user`
				request.session.user = result.rows[0];
			}

			// BIG surprise here! --- we probably got injected....funny - "injected" --- or simply Username and password did not match
			else {
				JSON = {
					success:    false,
					code:       "NOT_COOL",
					message:    "you're FAT!"
				};
			}
		}

		qJSON.JSON (response, JSON);
	});
}



function signup (request, response) {
	response.end ("SIGNUP");
}



/// don't get me started on REST for this app
/// this does NOT implement REST - thought it's close for an app
/// COMPLICATED as this
/// @param {Object} request
/// @param {Object} response
function rest (request, response) {
	// first thing is first - check your self before you wreck your self
	if (!crypto.logged_in (request.session) ) {
		qJSON.JSON (response, {error: "UNAUTHORIZED"})
	}

	// sperm-less like a girl - Metallica & Lou Reed
	else {
		if (request.body.mode === "CURRENT_USER") {
			qJSON.JSON (response, request.session.user);
		}

		else if (request.body.mode === "USER_LIST") {
			pg_client.query ("SELECT id, username, super_duper FROM users;", function (error, result) {
				if (!error) {
					qJSON.JSON (response, result.rows);
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "BRANCH_LIST") {
			pg_client.query ("SELECT * FROM branch;", function (error, result) {
				if (!error) {
					qJSON.JSON (response, result.rows);
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "REPORT_LIST") {
			pg_client.query ("SELECT * FROM report;", function (error, result) {
				if (!error) {
					qJSON.JSON (response, result.rows);
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "LOG_LIST") {
			pg_client.query ("SELECT * FROM log;", function (error, result) {
				if (!error) {
					qJSON.JSON (response, result.rows);
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "NEW_BRANCH") {
			if (request.session.user.super_duper) {
				var NEW_BRANCH = {};

				pg_client.query ('INSERT INTO branch (branch_name, service_type, speed, access_type, service_no, ip_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;', [request.body.new_branch.branch_name, request.body.new_branch.service_type, request.body.new_branch.speed, request.body.new_branch.access_type, request.body.new_branch.service_no, request.body.new_branch.ip_address], function (error, result) {
					if (!error) {
						NEW_BRANCH = result.rows[0];

						pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "added NEW Branch ["+  NEW_BRANCH.branch_name +"]"], function (error, result) {
							if (!error) {
								qJSON.JSON (response, {NEW_BRANCH: NEW_BRANCH, LOG: result.rows[0]});
							}

							else {
								qJSON.JSON (response, error);
							}
						});
					}

					else {
						qJSON.JSON (response, error);
					}
				});
			}

			else {
				qJSON.JSON (response, {"DUDE": "WTF are you doing?!"});
			}
		}

		else if (request.body.mode === "UPDATE_BRANCH") {
			if (request.session.user.super_duper) {
				var UPDATED_BRANCH = {};

				pg_client.query ('UPDATE branch SET branch_name=$1, service_type=$2, speed=$3, access_type=$4, service_no=$5, ip_address=$6 WHERE id=$7 RETURNING *;', [request.body.update_branch.branch_name, request.body.update_branch.service_type, request.body.update_branch.speed, request.body.update_branch.access_type, request.body.update_branch.service_no, request.body.update_branch.ip_address, request.body.update_branch.id], function (error, result) {
					if (!error) {
						UPDATED_BRANCH = result.rows[0];

						pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "edited branch ["+  UPDATED_BRANCH.branch_name +"]"], function (error, result) {
							if (!error) {
								qJSON.JSON (response, {UPDATED_BRANCH: UPDATED_BRANCH, LOG: result.rows[0]});
							}

							else {
								qJSON.JSON (response, error);
							}
						});
					}

					else {
						qJSON.JSON (response, error);
					}
				});
			}

			else {
				qJSON.JSON (response, {"DUDE": "WTF are you doing?!"});
			}
		}

		else if (request.body.mode === "OPEN_REPORT") {
			var OPENED_BRANCH = {};

			pg_client.query ('INSERT INTO report (reported_by, ticket_no, status, branch) VALUES ($1, $2, $3, $4) RETURNING *;', [request.session.user.id, request.body.branch.ticket_no, "OPEN", request.body.branch.id], function (error, result) {
				if (!error) {
					OPENED_BRANCH = result.rows[0];
					OPENED_BRANCH.branch = request.body.branch.branch_name;

					pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "reported branch ["+  OPENED_BRANCH.branch_name +"]"], function (error, result) {
						if (!error) {
							qJSON.JSON (response, {OPENED_BRANCH: OPENED_BRANCH, LOG: result.rows[0]});
						}

						else {
							qJSON.JSON (response, error);
						}
					});
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "CLOSE_REPORT") {
			var CLOSED_REPORT = {};

			// NOTE: this is realy easy to trick into making it believe
			// that her/she/other is the owner of the report
			// IF the loop-hole becomes "important" we'll be fixing it
			pg_client.query ('UPDATE report SET status=$1, ts_close=now() WHERE id=$2 RETURNING *;', ["CLOSED", request.body.report.id], function (error, result) {
				if (!error) {
					CLOSED_REPORT = result.rows[0];
					CLOSED_REPORT.reported_by = request.session.user.username;
					CLOSED_REPORT.branch_name = request.body.report.branch_name;

					pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "hurray!, report ["+  request.body.report.branch_name +"] closed"], function (error, result) {
						if (!error) {
							qJSON.JSON (response, {CLOSED_REPORT: CLOSED_REPORT, LOG: result.rows[0]});
						}

						else {
							qJSON.JSON (response, error);
						}
					});
				}

				else {
					qJSON.JSON (response, error);
				}
			});
		}

		else if (request.body.mode === "DELETE_BRANCH") {
			// well, ya sure we have to make sure he/she/other is a super duper
			if (request.session.user.super_duper) {
				pg_client.query ('DELETE FROM branch WHERE id=$1;', [request.body.delete_branch.id], function (error, result) {
					if (!error) {
						pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "ouch!, branch ["+  request.body.delete_branch.branch_name +"] has been DELETED!"], function (error, result) {
							if (!error) {
								qJSON.JSON (response, {DELETED_BRANCH: request.body.delete_branch, LOG: result.rows[0]});
							}

							else {
								qJSON.JSON (response, error);
							}
						});
					}

					else {
						qJSON.JSON (response, error);
					}
				});
			}

			else {
				qJSON.JSON (response, {"DUDE": "WTF are you doing?!"});
			}
		}

		else if (request.body.mode === "NEW_USER") {
			if (request.session.user.super_duper) {
				var NEW_USER = {};

				request.body.new_user.password = crypto.sha512 (request.body.new_user.password);
				pg_client.query ('INSERT INTO users (username, "password", email, super_duper) VALUES ($1, $2, $3, $4) RETURNING id, username, email, super_duper;', [request.body.new_user.username, request.body.new_user.password, request.body.new_user.email, request.body.new_user.super_duper], function (error, result) {
					if (!error) {
						NEW_USER = result.rows[0];

						pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "welcome back home [2X] ["+  NEW_USER.username +"]"], function (error, result) {
							if (!error) {
								qJSON.JSON (response, {NEW_USER: NEW_USER, LOG: result.rows[0]});
							}

							else {
								qJSON.JSON (response, error);
							}
						});
					}

					else {
						qJSON.JSON (response, error);
					}
				});
			}

			else {
				qJSON.JSON (response, {"DUDE": "WTF are you doing?!"});
			}
		}

		else if (request.body.mode === "DELETE_USER") {
			// well, ya sure we have to make sure he/she/other is a super duper
			if (request.session.user.super_duper) {
				pg_client.query ('DELETE FROM users WHERE id=$1;', [request.body.delete_user.id], function (error, result) {
					if (!error) {
						pg_client.query ('INSERT INTO log ("user", log) VALUES ($1, $2) RETURNING *;', [request.session.user.id, "you've been a BAD-BOY ["+  request.body.delete_user.username +"] - DELETED!"], function (error, result) {
							if (!error) {
								qJSON.JSON (response, {DELETED_USER: request.body.delete_user, LOG: result.rows[0]});
							}

							else {
								qJSON.JSON (response, error);
							}
						});
					}

					else {
						qJSON.JSON (response, error);
					}
				});
			}

			else {
				qJSON.JSON (response, {"DUDE": "WTF are you doing?!"});
			}
		}

		// phew!
		else if (request.body.mode === "LOG_OUT") {
			delete request.session.user;
			qJSON.JSON (response, {logged_out: true});
		}
	}
}