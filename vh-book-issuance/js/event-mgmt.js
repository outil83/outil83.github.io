(function($) {
    "use strict"; // Start of use strict

    const CACHE_KEY_LOCATIONS = "locations";
    const CACHE_EVICATION_LOCATIONS = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_SUPERVISORS = "supervisors";
    const CACHE_EVICATION_SUPERVISORS = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_MEMBERS = "members";
    const CACHE_EVICATION_MEMBERS = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_ENTRIES = "entries";
    const CACHE_EVICATION_ENTRIES = 1000 * 60 * 60 * 2; // 2 hours

    const CACHE_KEY_RECORDS = "records";
    const CACHE_EVICATION_RECORDS = 1000 * 60 * 60 * 2; // 2 hours

    const CACHE_KEY_STUDENTS = "studentKitInfo";
    const CACHE_EVICATION_STUDENTS = 1000 * 60 * 60; // 1 hour

    const CACHE_KEY_BOOKKITS = "bookKitInfo";
    const CACHE_EVICATION_BOOKKITS = 1000 * 60 * 60; // 1 hour

    
    const CACHE_KEY_FILTERS = "filters";
    const CACHE_EVICATION_FILTERS = 1000 * 60 * 60; // 1 hour

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



    //editted from here
    function Locations() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_LOCATIONS, new Cache(CACHE_KEY_LOCATIONS, this, CACHE_EVICATION_LOCATIONS)); // 1 minute

        this.locations = [];
        this.locationById = new Map();
        this.locationByName = new Map();
    }


    $.extend(Locations.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Location[]}
         */
        load: function(callback) {
            var arrLocations = $.cacheManager.get(CACHE_KEY_LOCATIONS).load(callback);
            arrLocations.forEach(location => {
                this.add(location);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_LOCATIONS).save(this.locations);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Location[]}
         */
        fromCache: function(content) {
            var arrLocations = this.cachable.fromCache(content);
            var arrResult = [];
            arrLocations.forEach(jsonLocation => {
                arrResult.push(Location.fromJson(jsonLocation));
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
         * @param {Location} location 
         */
        add : function(location) {
            this.locations.push(location);
            this.locationById.set(location.getId(), location);
            this.locationByName.set(location.getCity() + " / " + location.getBranch(), location);
        },

        /**
         * 
         * @param {string} locationId 
         * @returns {Location}
         */
        getById : function(locationId) {
            return this.locationById.get(locationId);
        },

        /**
         * 
         * @param {string} locationName 
         * @returns {Location}
         */
        getByName : function(locationName) {
            return this.locationByName.get(locationName);
        },

        /**
         * 
         * @returns {Location[]}
         */
        getAll : function() {
            return this.locations;
        }
    });

    /**
     * 
     * @param {string} id 
     * @param {string} branch 
     * @param {string} city 
     * @param {string} state 
     * @param {string} country 
     * @param {string} cluster 
     */
    function Location(id, branch, city, state, country , cluster) {
        this.id = id;
        this.branch = branch;
        this.city = city;
        this.state = state;
        this.country = country;
        this.cluster = cluster;
    }

    $.extend(Location.prototype, {
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
        getBranch : function () {
            return this.branch;
        },

        /**
         * 
         * @returns {string}
         */
        getCity : function () {
            return this.city;
        },

        /**
         * 
         * @returns {string}
         */
        getState : function () {
            return this.state;
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
        getCluster : function() {
            return this.cluster;
        }
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Location}
     */
    Location.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new Location(
            row[metadata.id.index], 
            row[metadata.branch.index], 
            row[metadata.city.index], 
            row[metadata.state.index], 
            row[metadata.country.index],
            row[metadata.cluster.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Location}
     */
    Location.fromJson = function (data) {
        return new Location(
            data["id"],
            data["branch"], 
            data["city"], 
            data["state"], 
            data["country"],
            data["cluster"]
        );
    };


    
    //editted till here


    
    function BookKits() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_BOOKKITS, new Cache(CACHE_KEY_BOOKKITS, this, CACHE_EVICATION_BOOKKITS)); // 1 minute

        this.BookKits = [];
        this.BookKitById = new Map();
        this.BookKitByName = new Map();
    }


    $.extend(BookKits.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {BookKit[]}
         */
        load: function(callback) {
            var arrBookKits = $.cacheManager.get(CACHE_KEY_BOOKKITS).load(callback);
            arrBookKits.forEach(bookKit => {
                this.add(bookKit);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_BOOKKITS).save(this.bookKits);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Location[]}
         */
        fromCache: function(content) {
            var arrBookKits = this.cachable.fromCache(content);
            var arrResult = [];
            arrBookKits.forEach(jsonBookKit => {
                arrResult.push(bookKit.fromJson(jsonBookKit));
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
         * @param {bookKit} location 
         */
        add : function(bookKit) {
            this.BookKits.push(bookKit);
            this.BookKitById.set(bookKit.getId(), bookKit);
            this.BookKitByName.set(bookKit.getKitName() , bookKit);
        },

        /**
         * 
         * @param {string} locationId 
         * @returns {Location}
         */
        getById : function(bookKitId) {
            return this.BookKitById.get(bookKitId);
        },

        /**
         * 
         * @param {string} bookKitName 
         * @returns {Location}
         */
        getByName : function(bookKitName) {
            return this.BookKitByName.get(bookKitName);
        },

        /**
         * 
         * @returns {Location[]}
         */
        getAll : function() {
            return this.bookKits;
        }
    });

    /**
     * 
     * @param {string} id 
     * @param {string} branch 
     * @param {string} city 
     * @param {string} state 
     * @param {string} country 
     */
    function BookKit(id, kitName, subject) {
        this.id = id;
        this.kitName = kitName;
        this.subject = subject;
    }

    $.extend(BookKit.prototype, {
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
        getKitName : function () {
            return this.kitName;
        },

        /**
         * 
         * @returns {string}
         */
        getSubject : function () {
            return this.subject;
        }
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Location}
     */
    BookKit.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new BookKit(
            row[metadata.id.index], 
            row[metadata.kitName.index], 
            row[metadata.subject.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Location}
     */
    BookKit.fromJson = function (data) {
        return new BookKit(
            data["id"],
            data["kitName"], 
            data["subject"]
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
     * @param {string} locationId 
     */
    function Supervisor(id, name, gender, otp , locationId)  {
        this.id = id;
        this.name = name;
        this.gender = gender;
        this.otp = otp;
        this.locationId = locationId;
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
        
        /**
         * 
         * @returns {string}
         */
        getLocationId : function() {
            return this.locationId;
        }

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
            row[metadata.otp.index],
            row[metadata.locationId.index],
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
            data["otp"],
            data["locationId"]
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


    // editting from here

    /**
     * Constructs new instance of Student
     */
    function Students() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_STUDENTS, new Cache(CACHE_KEY_STUDENTS, this, CACHE_EVICATION_STUDENTS));

        this.students = [];
        this.studentById = new Map();
        this.studentByName = new Map();
    }

    $.extend(Students.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Student[]}
         */
        load: function(callback) {
            var arrStudents = $.cacheManager.get(CACHE_KEY_STUDENTS).load(callback);
            arrStudents.forEach(student => {
                this.add(student);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_STUDENTS).save(this.students);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Student[]}
         */
        fromCache: function(content) {
            var arrStudents = this.cachable.fromCache(content);
            var arrResult = [];
            arrStudents.forEach(jsonStudent => {
                arrResult.push(Student.fromJson(jsonStudent));
            });
            return arrResult;
        },

        /**
         * 
         * @param {Student[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Student} member 
         */
        add : function(student) {
            this.students.push(student);
            this.studentById.set(student.getId(), student);
            this.studentByName.set(student.getName(), student);
        },

        /**
         * 
         * @param {string} studentId 
         * @returns {Student}
         */
        getById : function(studentId) {
            return this.studentById.get(studentId);
        },

        /**
         * 
         * @param {string} studentName 
         * @returns {Student}
         */
        getByName : function(studentName) {
            return this.studentByName.get(studentName);
        },

        
       
        /**
         * 
         * @returns {Student[]}
         */
        getAll : function() {
            return this.students;       
        }
    

    });

    /**
     * 
     * @param {string} id 
     * @param {string} name 
     * @param {string} schoolName
     * @param {string} board 
     * @param {string} location 
     * @param {string} grade 
     * @param {string} bookKitName 
     * @param {string} emailId 
     * @param {string} mobileNo
     * @param {string} paymentStatus
     */
    function Student(id, name, schoolName ,board, location, grade, division , bookKitName, emailId, mobileNo,paymentStatus) {
        this.id = id;
        this.name = name;
        this.schoolName = schoolName;
        this.board = board;
        this.location = location;
        this.grade = grade;
        this.division = division;
        this.bookKitName = bookKitName;
        this.emailId = emailId;
        this.mobileNo = mobileNo;
        this.paymentStatus = paymentStatus;

    }

    $.extend(Student.prototype, {
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
        getSchoolName : function () {
            return this.schoolName;
        },

        /**
         * 
         * @returns {string}
         */
        getBoard : function () {
            return this.board;
        },

        /**
         * 
         * @returns {string}
         */
        getLocation : function() {
            return this.location;
        },

        /**
         * 
         * @returns {string}
         */
        getGrade : function() {
            return this.grade;
        },

        /**
         * 
         * @returns {string}
         */
        getDivision : function() {
            return this.division;
        },
        /**
         * 
         * @returns {string}
         */
        getBookKitName : function() {
            return this.bookKitName;
        },

        /**
         * 
         * @returns {string}
         */
        getEmailId : function() {
            return this.emailId;
        },

        /**
         * 
         * @returns {string}
         */
        getMobileNo : function() {
            return this.mobileNo;
        },

        /**
         * 
         * @returns {string}
         */
        getPaymentStatus : function() {
            return this.paymentStatus;
        }
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Student}
     */
    Student.fromRecord = function (row, metadata) {
        if (!row[metadata.id.index] || row[metadata.id.index] === "") {
            return ;
        }
        return new Student(
            row[metadata.id.index], 
            row[metadata.name.index],
            row[metadata.schoolName.index],  
            row[metadata.board.index], 
            row[metadata.location.index],
            row[metadata.grade.index],
            row[metadata.division.index],
            row[metadata.bookKitName.index],
            row[metadata.emailId.index],
            row[metadata.mobileNo.index],
            row[metadata.paymentStatus.index],
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Student}
     */
    Student.fromJson = function (data) {
        return new Student(
            data["id"], 
            data["name"], 
            data["schoolName"], 
            data["board"], 
            data["location"],
            data["grade"],
            data["division"],
            data["bookKitName"],
            data["emailId"],
            data["mobileNo"],
            data["paymentStatus"],
        );
    };

    // Editting from here 
    function Records() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_RECORDS, new Cache(CACHE_KEY_RECORDS, this, CACHE_EVICATION_RECORDS));

        this._records = [];
        this._recordsByLocationId = new Map();
        this._recordsByUniqueId = new Map();
        this._recordsByEnrollmentId = new Map();
    }

    $.extend(Records.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Record[]}
         */
        load: function(callback) {
            var arrRecords = $.cacheManager.get(CACHE_KEY_RECORDS).load(callback);
            arrRecords.forEach(record => {
                this.add(record);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_RECORDS).save(this._records);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Record[]}
         */
        fromCache: function(content) {
            var arrRecords = this.cachable.fromCache(content);
            var arrResult = [];
            arrRecords.forEach(jsonRecord => {
                arrResult.push(Record.fromJson(jsonRecord));
            });
            return arrResult;
        },

        /**
         * 
         * @param {Record[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        /**
         * 
         * @param {Record} record
         * @returns {string} 
         */
        getUniqueIdFromRecord : function (record) {
            return this.getUniqueId(record.getEnrollmentId());
        },

        /**
         * 
         * @param {string} enrollmetId 
         * @param {string} locationId 
         * @returns {string}
         */
        getUniqueId : function (enrollmetId) {
            return enrollmetId ;
        },

        /**
         * 
         * @param {Record} record 
         */
        add : function(record) {
            this._records.push(record);

            var recordUniqueId = this.getUniqueIdFromRecord(record);
            this._recordsByUniqueId.set(recordUniqueId, record);

            var recordsByEnrollmentId = this._recordsByEnrollmentId.get(record.getEnrollmentId());
            if (!recordsByEnrollmentId) {
                recordsByEnrollmentId = [];
            }
            recordsByEnrollmentId.push(record);
            this._recordsByEnrollmentId.set(record.getEnrollmentId(), recordsByEnrollmentId);

            var recordsByLocationId = this._recordsByLocationId.get(record.getLocationId());
            if (!recordsByLocationId) {
                recordsByLocationId = [];
            }
            recordsByLocationId.push(record);
            this._recordsByLocationId.set(record.getLocationId(), recordsByLocationId);
        },

        /**
         * 
         * @param {string} uniqueId 
         * @returns {Record}
         * @see getUniqueId
         * @see getUniqueIdFromRecord
         */
        getByUniqueId : function(uniqueId) {
            return this._recordsByUniqueId.get(uniqueId);
        },

        /**
         * 
         * @param {string} enrollmentId 
         * @returns {Record[]}
         */
        getByEnrollmentId : function(enrollmentId) {
            return this._recordsByEnrollmentId.get(enrollmentId);
        },

        /**
         * 
         * @param {string} locationId 
         * @returns {Record[]}
         */
        getByLocationId : function(locationId) {
            return this._recordsByLocationId.get(locationId);
        },

        /**
         * 
         * @returns {Record[]}
         */
        getAll : function() {
            return this._records;
        }
    });
    /**
     * 
     * @param {string} timestamp 
     * @param {string} enrollmentId 
     * @param {string} status 
     * @param {string} superviserId 
     * @param {string} locationId 
     */
    function Record(timestamp, enrollmentId, status, superviserId, locationId,collectedBy) {
        this.timestamp = timestamp;
        this.enrollmentId = enrollmentId;
        this.status = status;
        this.superviserId = superviserId;
        this.locationId = locationId;
        this.collectedBy = collectedBy;
    }

    $.extend(Record.prototype, {
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
        getEnrollmentId : function () {
            return this.enrollmentId;
        },

        /**
         * 
         * @returns {string}
         */
        getSuperviserId : function () {
            return this.superviserId;
        },

        /**
         * 
         * @returns {string}
         */
        getStatus : function () {
            return this.status;
        },

        /**
         * 
         * @returns {string}
         */
        getLocationId : function () {
            return this.locationId;
        },

        
        /**
         * 
         * @returns {string}
         */
        getCollectedBy : function () {
            return this.collectedBy;
        }
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Record}
     */
    Record.fromRecord = function (row, metadata) {
        if (!row[metadata.timestamp.index] || row[metadata.timestamp.index] === "") {
            return ;
        }
        return new Record(
            row[metadata.timestamp.index], 
            row[metadata.enrollmentId.index], 
            row[metadata.status.index], 
            row[metadata.superviserId.index], 
            row[metadata.locationId.index],
            row[metadata.collectedBy.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Record}
     */
    Record.fromJson = function (data) {
        return new Record(
            data["timestamp"], 
            data["enrollmentId"], 
            data["status"], 
            data["superviserId"], 
            data["locationId"],
            data["collectedBy"]
        );
    };
    //Editted till here

    //priyanka added

      //priyanka

      function Filters() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_FILTERS, new Cache(CACHE_KEY_FILTERS, this, CACHE_EVICATION_RECORDS));

        this._filters = [];
        this._filtersByGrade = new Map();
        this._filtersByBoard = new Map();
        this._filtersByDivision = new Map();
    }

    $.extend(Filters.prototype, {

        /**
         * 
         * @param {function} callback 
         * @returns {Filter[]}
         */
        load: function(callback) {
            var arrFilters = $.cacheManager.get(CACHE_KEY_FILTERS).load(callback);
            arrFilters.forEach(filter => {
                this.add(filter);
            });
            return this.getAll();
        },

        save: function() {
            $.cacheManager.get(CACHE_KEY_FILTERS).save(this._records);
        },

        /**
         * 
         * @param {string} content 
         * @returns {Filter[]}
         */
        fromCache: function(content) {
            var arrFilters = this.cachable.fromCache(content);
            var arrFilter = [];
            arrFilters.forEach(jsonRecord => {
                arrFilter.push(Filter.fromJson(jsonRecord));
            });
            return arrFilter;
        },

        /**
         * 
         * @param {Filter[]} data 
         * @returns {string} content to be cached
         */
        toCache: function(data) {
            return this.cachable.toCache(data);
        },

        
        /**
         * 
         * @param {Filter} record 
         */
        add : function(filter) {
            this._filters.push(filter);

        },

        
        /**
         * 
         * @returns {Filter[]}
         */
        getAll : function() {
            return this._filters;
        }
    });


    /**
     * 
     * @param {string} board 
     * @param {string} grade 
     * @param {string} division 
     * @param {string} paymentStatus 
     * @param {string} handoverStatus 
     * @param {string} schoolName
     */
    function Filter(grade,board ,division, paymentStatus, handoverStatus,schoolName) {
        this.grade = grade;
        this.board = board;
        this.division = division;
        this.paymentStatus = paymentStatus;
        this.handoverStatus = handoverStatus;
        this.schoolName = schoolName;
    }

    $.extend(Filter.prototype, {
        /**
         * 
         * @returns {string}
         */
        getGrade : function () {
            return this.grade;
        },

        /**
         * 
         * @returns {string}
         */
        getBoard : function () {
            return this.board;
        },


        /**
         * 
         * @returns {string}
         */
        getDivision : function () {
            return this.division;
        },

        /**
         * 
         * @returns {string}
         */
        getPaymentStatus : function () {
            return this.paymentStatus;
        },

        /**
         * 
         * @returns {string}
         */
        getHandoverStatus : function () {
            return this.handoverStatus;
        },

        /**
         * 
         * @returns {string}
         */
        getSchoolName : function () {
            return this.schoolName;
        },
        
    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Record}
     */
    Filter.fromRecord = function (row, metadata) {
        if (!row[metadata.grade.index] || row[metadata.grade.index] === "") {
            return ;
        }
        return new Filter(
            row[metadata.grade.index], 
            row[metadata.board.index], 
            row[metadata.division.index], 
            row[metadata.paymentStatus.index], 
            row[metadata.handoverStatus.index],
            row[metadata.schoolName.index]
        );
    };

    /**
     * 
     * @param {object} data 
     * @returns {Record}
     */
    Filter.fromJson = function (data) {
        return new Filter(
            data["grade"], 
            data["board"], 
            data["division"], 
            data["paymentStatus"], 
            data["handoverStatus"],
            data["schoolName"]
        );
    };

  
    //priyanka ended

    //priyanka

    $.Cache = Cache;
    $.Cachable = Cachable;
    $.Locations = Locations;
    $.Location = Location;
    $.Supervisors = Supervisors;
    $.Supervisor = Supervisor;
    $.Students = Students;
    $.Student = Student;
    $.Records = Records;
    $.Record = Record;       
    $.BookKits = BookKits;
    $.BookKit = BookKit; 
    $.Filters = Filters;
    $.Filter = Filter;  
   
})(jQuery);
