(function($) {
    "use strict"; // Start of use strict

    function Activities() {
        this.activities = [];
        this.activityById = new Map();
        this.activityByName = new Map();
    }

    $.extend(Activities.prototype, {

        /**
         * 
         * @param {Activity} activity 
         */
        add : function(activity) {
            this.activities.push(activity);
            this.activityById.set(activity.getId(), activity);
            this.activityByName.set(activity.getName(), activity);
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
        return new Activity(
            row[metadata.id.index], 
            row[metadata.group.index], 
            row[metadata.name.index], 
            row[metadata.description.index], 
            row[metadata.max.index],
            row[metadata.custom.index]
        );
    };

    function Supervisors() {
        this.supervisors = [];
        this.supervisorById = new Map();
        this.supervisorByName = new Map();
    }

    $.extend(Supervisors.prototype, {

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
        return new Supervisor(
            row[metadata.id.index], 
            row[metadata.name.index], 
            row[metadata.gender.index], 
            row[metadata.otp.index]
        );
    };
    
    /**
     * Constructs new instance of Members
     */
    function Members() {
        this.members = [];
        this.memberById = new Map();
        this.memberByName = new Map();
    }

    $.extend(Members.prototype, {

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
     * @returns {Supervisor}
     */
    Member.fromRecord = function (row, metadata) {
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

    function Entries() {
        this._entries = [];
        this._entriesByUniqueId = new Map();
        this._entriesByMemberId = new Map();
    }

    $.extend(Entries.prototype, {

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
        return new Entry(
            row[metadata.timestamp.index], 
            row[metadata.supervisorId.index], 
            row[metadata.activityId.index], 
            row[metadata.memberId.index], 
            row[metadata.remarks.index]
        );
    };
    
    $.Activities = Activities;
    $.Activity = Activity;
    $.Supervisors = Supervisors;
    $.Supervisor = Supervisor;
    $.Members = Members;
    $.Member = Member;
    $.Entries = Entries;
    $.Entry = Entry;
    
})(jQuery);
