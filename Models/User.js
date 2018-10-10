const mongoose = require('mongoose');

let userSchema = new mongoose.Schema({
    username: String,
    email: String,
    name: String,
    description: String,
    startYear: String,
    location: String,
    organisation: String,
    url: String,
    repos: String,
    followers: String,
    following: String,
    stars: String,
    dateCrawled: Date
});

let User = mongoose.model('User', userSchema);

module.exports = User;
