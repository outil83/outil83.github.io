(function($) {
    "use strict"; // Start of use strict

    const CACHE_KEY_ACTIVITIES = "activities";
    const CACHE_EVICATION_ACTIVITIES = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_SUPERVISORS = "supervisors";
    const CACHE_EVICATION_SUPERVISORS = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_MEMBERS = "members";
    const CACHE_EVICATION_MEMBERS = 1000 * 60 * 10; // 10 minutes

    const CACHE_KEY_ENTRIES = "entries";
    const CACHE_EVICATION_ENTRIES = 1000 * 60 * 60 * 2; // 2 hour

    function Cachable() {
        // DO NOTHING
    }

    $.extend(Cachable.prototype, {

        /**
         * 
         * @param {string} content 
         * @returns {any}
         */
        fromCache: function(content) {
            return JSON.parse(content);
        },

        /**
         * 
         * @param {any} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return JSON.stringify(data);
        }
        
    });

    function CacheManager() {
        this.mapCache = new Map();
    }

    $.extend(CacheManager.prototype, {

        /**
         * 
         * @param {string} cacheKey 
         * @param {Cache} cache 
         */
        register: function(cacheKey, cache) {
            this.mapCache.set(cacheKey, cache);
        },

        /**
         * 
         * @param {string} cacheKey 
         * @returns {Cache}
         */
        get: function(cacheKey) {
            return this.mapCache.get(cacheKey);
        }
    });

    $.cacheManager = new CacheManager();

    /**
     * 
     * @param {Cachable} cachable 
     */
    function Cache(cacheKey, cachable, evicationPeriod) {
        this._cacheKey = cacheKey;
        this._cachable = cachable;
        this._evicationPeriod = evicationPeriod;
    }

    $.extend(Cache.prototype, {


        /**
         * 
         * @param {any} data 
         */
        save : function(data) {
            if (window.cacheEnabled === true) {
                localStorage.setItem(this._cacheKey, this._cachable.toCache(data));
                localStorage.setItem(this._cacheKey + "_time", JSON.stringify(new Date().getTime()));    
            } else {
                localStorage.removeItem(this._cacheKey);
                localStorage.removeItem(this._cacheKey + "_time");    
            }
        },

        /**
         * 
         * @param {function} callback 
         * @returns {object}
         */
        load : function(callback) {
            var strTime = localStorage.getItem(this._cacheKey + "_time");
            var strCachedData = localStorage.getItem(this._cacheKey)
            if (window.cacheEnabled === true && strTime && strCachedData) {
                var time = Number(strTime);
                if (new Date().getTime() - time < this._evicationPeriod) {
                    return this._cachable.fromCache(localStorage.getItem(this._cacheKey));
                }
                console.log("INFO: Cache.load - Eviction period has expired!")
            }
            console.log("INFO: Cache.enabled - " + window.cacheEnabled);
            var data = callback.call(null);
            this.save(data);
            return data;
        }
    });

    function Activities() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_ACTIVITIES, new Cache(CACHE_KEY_ACTIVITIES, this, CACHE_EVICATION_ACTIVITIES)); // 1 minute

        this.activities = [];
        this.activityById = new Map();
        this.activityByName = new Map();
    }


    $.extend(Activities.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Activity[]}
         */
        load: function(callback) {
            var arrActivities = $.cacheManager.get(CACHE_KEY_ACTIVITIES).load(callback);
            arrActivities.forEach(activity => {
                this.add(activity);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_ACTIVITIES).save(this.activities);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Activity[]}
         */
        fromCache: function(content) {
            var arrActivities = this.cachable.fromCache(content);
            var arrResult = [];
            arrActivities.forEach(jsonActivity => {
                arrResult.push(Activity.fromJson(jsonActivity));
            });
            return arrResult;
        },

        /**
         * 
         * @param {any} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Activity} activity 
         */
        add : function(activity) {
            this.activities.push(activity);
            this.activityById.set(activity.getId(), activity);
            this.activityByName.set(activity.getGroup() + " / " + activity.getName(), activity);
        },

        /**
         * 
         * @param {string} activityId 
         * @returns {Activity}
         */
        getById : function(activityId) {
            return this.activityById.get(activityId);
        },

        /**
         * 
         * @param {string} activityName 
         * @returns {Activity}
         */
        getByName : function(activityName) {
            return this.activityByName.get(activityName);
        },

        /**
         * 
         * @returns {Activity[]}
         */
        getAll : function() {
            return this.activities;
        }
    });

    /**
     * 
     * @param {string} id 
     * @param {string} group 
     * @param {string} name 
     * @param {string} description 
     * @param {string} maxAllowed 
     * @param {string} custom 
     */
    function Activity(id, group, name, description, maxAllowed, custom) {
        this.id = id;
        this.group = group;
        this.name = name;
        this.description = description;
        this.maxAllowed = maxAllowed;
        this.custom = custom;
    }

    $.extend(Activity.prototype, {
        /**
         * 
         * @returns {string}
         */
        getId : function () {
            return this.id;
        },

        /**
         * 
         * @returns {string}
         */
        getGroup : function () {
            return this.group;
        },

        /**
         * 
         * @returns {string}
         */
        getName : function () {
            return this.name;
        },

        /**
         * 
         * @returns {string}
         */
        getDescription : function () {
            return this.description;
        },

        /**
         * 
         * @returns {string}
         */
        getMaxAllowed : function() {
            return this.maxAllowed;
        },

        /**
         * 
         * @returns {string}
         */
        getCustom : function() {
            return this.custom;
        }
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Activity}
     */
    Activity.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new Activity(
            row[metadata.id.index], 
            row[metadata.group.index], 
            row[metadata.name.index], 
            row[metadata.description.index], 
            row[metadata.max.index],
            row[metadata.custom.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Activity}
     */
    Activity.fromJson = function (data) {
        return new Activity(
            data["id"],
            data["group"], 
            data["name"], 
            data["description"], 
            data["maxAllowed"],
            data["custom"]
        );
    };

    function Supervisors() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_SUPERVISORS, new Cache(CACHE_KEY_SUPERVISORS, this, CACHE_EVICATION_SUPERVISORS));

        this.supervisors = [];
        this.supervisorById = new Map();
        this.supervisorByName = new Map();
    }

    $.extend(Supervisors.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Supervisor[]}
         */
        load: function(callback) {
            var arrSupervisors = $.cacheManager.get(CACHE_KEY_SUPERVISORS).load(callback);
            arrSupervisors.forEach(supervisor => {
                this.add(supervisor);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_SUPERVISORS).save(this.supervisors);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Supervisor[]}
         */
        fromCache: function(content) {
            var arrSupervisors = this.cachable.fromCache(content);
            var arrResult = [];
            arrSupervisors.forEach(jsonSupervisor => {
                arrResult.push(Supervisor.fromJson(jsonSupervisor));
            });
            return arrResult;
        },

        /**
         * 
         * @param {Supervisor[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Supervisor} supervisor 
         */
        add : function(supervisor) {
            this.supervisors.push(supervisor);
            this.supervisorById.set(supervisor.getId(), supervisor);
            this.supervisorByName.set(supervisor.getName(), supervisor);
        },

        /**
         * 
         * @param {string} supervisorId 
         * @returns {Supervisor}
         */
        getById : function(supervisorId) {
            return this.supervisorById.get(supervisorId);
        },

        /**
         * 
         * @param {string} supervisorName 
         * @returns {Supervisor}
         */
        getByName : function(supervisorName) {
            return this.supervisorByName.get(supervisorName);
        },

        /**
         * 
         * @returns {Supervisor[]}
         */
        getAll : function() {
            return this.supervisors;
        }
    });


    /**
     * 
     * @param {string} id 
     * @param {string} name 
     * @param {string} gender
     * @param {string} otp 
     */
    function Supervisor(id, name, gender, otp) {
        this.id = id;
        this.name = name;
        this.gender = gender;
        this.otp = otp;
    }

    $.extend(Supervisor.prototype, {
        /**
         * 
         * @returns {string}
         */
        getId : function () {
            return this.id;
        },

        /**
         * 
         * @returns {string}
         */
        getName : function () {
            return this.name;
        },

        /**
         * 
         * @returns {string}
         */
        getGender : function () {
            return this.gender;
        },

        /**
         * 
         * @returns {string}
         */
        getOtp : function() {
            return this.otp;
        },

    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Supervisor}
     */
    Supervisor.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new Supervisor(
            row[metadata.id.index], 
            row[metadata.name.index], 
            row[metadata.gender.index], 
            row[metadata.otp.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Supervisor}
     */
    Supervisor.fromJson = function (data) {
        return new Supervisor(
            data["id"], 
            data["name"], 
            data["gender"], 
            data["otp"]
        );
    };
    
    /**
     * Constructs new instance of Members
     */
    function Members() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_MEMBERS, new Cache(CACHE_KEY_MEMBERS, this, CACHE_EVICATION_MEMBERS));

        this.members = [];
        this.memberById = new Map();
        this.memberByName = new Map();
    }

    $.extend(Members.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Member[]}
         */
        load: function(callback) {
            var arrMembers = $.cacheManager.get(CACHE_KEY_MEMBERS).load(callback);
            arrMembers.forEach(member => {
                this.add(member);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_MEMBERS).save(this.members);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Member[]}
         */
        fromCache: function(content) {
            var arrMembers = this.cachable.fromCache(content);
            var arrResult = [];
            arrMembers.forEach(jsonMember => {
                arrResult.push(Member.fromJson(jsonMember));
            });
            return arrResult;
        },

        /**
         * 
         * @param {Member[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Member} member 
         */
        add : function(member) {
            this.members.push(member);
            this.memberById.set(member.getId(), member);
            this.memberByName.set(member.getName(), member);
        },

        /**
         * 
         * @param {string} memberId 
         * @returns {Member}
         */
        getById : function(memberId) {
            return this.memberById.get(memberId);
        },

        /**
         * 
         * @param {string} memberName 
         * @returns {Member}
         */
        getByName : function(memberName) {
            return this.memberByName.get(memberName);
        },

        /**
         * 
         * @returns {Member[]}
         */
        getAll : function() {
            return this.members;
        }
    });

    /**
     * 
     * @param {string} id 
     * @param {string} name 
     * @param {string} gender 
     * @param {string} country 
     * @param {string} committee 
     * @param {string} school 
     * @param {string} registration 
     * @param {string} accomodation 
     * @param {string} schedule 
     */
    function Member(id, name, gender, country, committee, school, registration, accomodation, schedule) {
        this.id = id;
        this.name = name;
        this.gender = gender;
        this.country = country;
        this.committee = committee;
        this.school = school;
        this.registration = registration;
        this.accomodation = accomodation;
        this.schedule = schedule;
    }

    $.extend(Member.prototype, {
        /**
         * 
         * @returns {string}
         */
        getId : function () {
            return this.id;
        },

        /**
         * 
         * @returns {string}
         */
        getName : function () {
            return this.name;
        },

        /**
         * 
         * @returns {string}
         */
        getGender : function () {
            return this.gender;
        },

        /**
         * 
         * @returns {string}
         */
        getCountry : function() {
            return this.country;
        },

        /**
         * 
         * @returns {string}
         */
        getCommittee : function() {
            return this.committee;
        },

        /**
         * 
         * @returns {string}
         */
        getSchool : function() {
            return this.school;
        },

        /**
         * 
         * @returns {string}
         */
        getRegistration : function() {
            return this.registration;
        },

        /**
         * 
         * @returns {string}
         */
        getAccomodation : function() {
            return this.accomodation;
        },

        /**
         * 
         * @returns {string}
         */
        getSchedule : function() {
            return this.schedule;
        }

    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Member}
     */
    Member.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new Member(
            row[metadata.id.index], 
            row[metadata.name.index], 
            row[metadata.gender.index], 
            row[metadata.country.index],
            row[metadata.committee.index],
            row[metadata.school.index],
            row[metadata.registration.index],
            row[metadata.accomodation.index],
            row[metadata.schedule.index],
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Member}
     */
    Member.fromJson = function (data) {
        return new Member(
            data["id"], 
            data["name"], 
            data["gender"], 
            data["country"],
            data["committee"],
            data["school"],
            data["registration"],
            data["accomodation"],
            data["schedule"],
        );
    };

    function Entries() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_ENTRIES, new Cache(CACHE_KEY_ENTRIES, this, CACHE_EVICATION_ENTRIES));

        this._entries = [];
        this._entriesByActivityId = new Map();
        this._entriesByUniqueId = new Map();
        this._entriesByMemberId = new Map();
    }

    $.extend(Entries.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Entry[]}
         */
        load: function(callback) {
            var arrEntries = $.cacheManager.get(CACHE_KEY_ENTRIES).load(callback);
            arrEntries.forEach(entry => {
                this.add(entry);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_ENTRIES).save(this._entries);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Entry[]}
         */
        fromCache: function(content) {
            var arrEntries = this.cachable.fromCache(content);
            var arrResult = [];
            arrEntries.forEach(jsonEntry => {
                arrResult.push(Entry.fromJson(jsonEntry));
            });
            return arrResult;
        },

        /**
         * 
         * @param {Entry[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Entry} entry
         * @returns {string} 
         */
        getUniqueIdFromEntry : function (entry) {
            return this.getUniqueId(entry.getMemberId(), entry.getActivityId());
        },

        /**
         * 
         * @param {string} memberId 
         * @param {string} activityId 
         * @returns {string}
         */
        getUniqueId : function (memberId, activityId) {
            return memberId + "_" + activityId;
        },

        /**
         * 
         * @param {Entry} entry 
         */
        add : function(entry) {
            this._entries.push(entry);

            var entryUniqueId = this.getUniqueIdFromEntry(entry);
            this._entriesByUniqueId.set(entryUniqueId, entry);

            var entriesByMemberId = this._entriesByMemberId.get(entry.getMemberId());
            if (!entriesByMemberId) {
                entriesByMemberId = [];
            }
            entriesByMemberId.push(entry);
            this._entriesByMemberId.set(entry.getMemberId(), entriesByMemberId);

            var entriesByActivityId = this._entriesByActivityId.get(entry.getActivityId());
            if (!entriesByActivityId) {
                entriesByActivityId = [];
            }
            entriesByActivityId.push(entry);
            this._entriesByActivityId.set(entry.getActivityId(), entriesByActivityId);
        },

        /**
         * 
         * @param {string} uniqueId 
         * @returns {Entry}
         * @see getUniqueId
         * @see getUniqueIdFromEntry
         */
        getByUniqueId : function(uniqueId) {
            return this._entriesByUniqueId.get(uniqueId);
        },

        /**
         * 
         * @param {string} memberId 
         * @returns {Entry[]}
         */
        getByMemberId : function(memberId) {
            return this._entriesByMemberId.get(memberId);
        },

        /**
         * 
         * @param {string} activityId 
         * @returns {Entry[]}
         */
        getByActivityId : function(activityId) {
            return this._entriesByActivityId.get(activityId);
        },

        /**
         * 
         * @returns {Entry[]}
         */
        getAll : function() {
            return this._entries;
        }
    });


    /**
     * 
     * @param {string} timestamp 
     * @param {string} supervisorId 
     * @param {string} activityId 
     * @param {string} memberId 
     * @param {string} remarks 
     */
    function Entry(timestamp, supervisorId, activityId, memberId, remarks) {
        this.timestamp = timestamp;
        this.supervisorId = supervisorId;
        this.activityId = activityId;
        this.memberId = memberId;
        this.remarks = remarks;
    }

    $.extend(Entry.prototype, {
        /**
         * 
         * @returns {string}
         */
        getTimestamp : function () {
            return this.timestamp;
        },

        /**
         * 
         * @returns {string}
         */
        getSupervisorId : function () {
            return this.supervisorId;
        },

        /**
         * 
         * @returns {string}
         */
        getActivityId : function () {
            return this.activityId;
        },

        /**
         * 
         * @returns {string}
         */
        getMemberId : function () {
            return this.memberId;
        },

        /**
         * 
         * @returns {string}
         */
        getRemarks : function () {
            return this.remarks;
        }

    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Entry}
     */
    Entry.fromRecord = function (row, metadata) {
        if (!row[metadata.timestamp.index] || row[metadata.timestamp.index] === "") {
            return ;
        }
        return new Entry(
            row[metadata.timestamp.index], 
            row[metadata.supervisorId.index], 
            row[metadata.activityId.index], 
            row[metadata.memberId.index], 
            row[metadata.remarks.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Entry}
     */
    Entry.fromJson = function (data) {
        return new Entry(
            data["timestamp"], 
            data["supervisorId"], 
            data["activityId"], 
            data["memberId"], 
            data["remarks"]
        );
    };

    $.Cache = Cache;
    $.Cachable = Cachable;
    $.Activities = Activities;
    $.Activity = Activity;
    $.Supervisors = Supervisors;
    $.Supervisor = Supervisor;
    $.Members = Members;
    $.Member = Member;
    $.Entries = Entries;
    $.Entry = Entry;
    
})(jQuery);
