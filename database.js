logger = global.logger;

var mysql = require('mysql');
var connectionResets = 0;
var db_config = {
	host : process.env.SQL_HOST,
	port : process.env.SQL_PORT,
  user : process.env.SQL_USER,
  password : process.env.SQL_PASS,
  database : process.env.SQL_DATABASE
}
var connection;
/*
 * Entry Condition: The Remote SQL Server is Disconnected
 * Action: Attempt to establish connection to databse
 */
function handleDisconnect() {
	connection = mysql.createConnection(db_config); // Recreate the connection, since
													// the old one cannot be reused.
  
	connection.connect(function(err) {              // The server is either down
	  if(err) {                                     // or restarting (takes a while sometimes).
		logger.error('Error establishing connection... retrying', err);
		setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
		}     
		else{
			connectionResets = 0;
		}                                // to avoid a hot loop, and to allow our node script to
	});                                     // process asynchronous requests in the meantime.
											// If you're also serving http, display a 503 error.
	connection.on('error', function(err) {
	  connectionResets++;
		if (connectionResets < 5) {				 //try to connect to the db again 5 times at most
			handleDisconnect();	                      
		} else {
			logger.error("Could not establish database connection");
			throw err;     
		}
	});
  }
logger.info(`Connecting to database with parameters: ${JSON.stringify(db_config)}`);
handleDisconnect();
/*
 * Entry Condition: Bot has just started, or has updated user info
 * Action: Retrieve current user data from the database
 */
exports.getUsers = function() {
	return new Promise(function(resolve, reject) {
		connection.query(`SELECT id, permissions FROM bot_permissions`, function (error, results, fields) {
			if (error) return reject(error);
			var ids = new Map();
			for(var i=0; i < results.length; i++){
				ids[results[i].id] =  results[i].permissions;
			}
			return resolve(ids);
		});
	});
};

/*
 * Entry Condition: Promote user command has been issued
 * Action: Increase user's permission level
 * @param {DiscordJS User} user - user to promote
 */
exports.promoteUser = function(user) {
	return new Promise(function(resolve, reject) {
		connection.query(
			`INSERT INTO bot_permissions VALUES (
				${user.id}, "${user.username}", "${user.discriminator}", 1, NULL
			)	ON DUPLICATE KEY UPDATE permissions=permissions+1`,
		function (error, results, fields) {
			if (error) return reject(error);
			return resolve(results);
		});
	});
}

/*
 * Entry Condition: Demote user command has been issued
 * Action: Decrease user's permission level
 * @param {DiscordJS User} user - user to demote
 */
exports.demoteUser = function(user) {
	return new Promise(function(resolve, reject) {
		connection.query(`UPDATE bot_permissions SET permissions=permissions-1 WHERE 
		id=${parseInt(user.id)};`,
		function (error, results, fields) {
			if (error) return reject(error);
			return resolve(results);
		});
	});
}
/*
 * Entry Condition: Set special channel command has been issued
 * Action: Set special channel information in database
 * @param {string} role - channel role
 * @param {string} id - channel id
 * @param {string} name - channel name
 */
exports.setSpecialChannel = function(role, id, name) {
	return new Promise(function(resolve, reject) {
		connection.query(`INSERT INTO special_channels VALUES (
			"${role}", ${id}, "${name}"
		) ON DUPLICATE KEY UPDATE id= ${id}, name="${name}"`, function (error, results, fields) {
			if (error) return reject(error);
			return resolve(results);
		});
	});
}
/*
 * Entry Condition: Remove special channel command has been issued
 * Action: Remove special channel information in database
 * @param {string} role - channel role to remove
 */
exports.removeSpecialChannel = function(role) {
	return new Promise(function(resolve, reject) {
		connection.query(`DELETE FROM special_channels WHERE role="${role}"`,
		 function (error, results, fields) {
			if (error) return reject(error);
			return resolve(results);
		});
	});
}
/*
 * Entry Condition: Bot has started or special channel information has been updated
 * Action: Get the special channel information
 */
exports.getSpecialChannels = function(){
	return new Promise(function(resolve, reject) {
		connection.query(`SELECT role, id FROM special_channels`, function (error, results, fields) {
			if (error) return reject(error);
			var roles = new Map();
			for(var i=0; i < results.length; i++){
				roles[results[i].role] =  results[i].id;
			}
			return resolve(roles);
		});
	});
}
exports.addLog = function(){};