(function($) {
    "use strict"; // Start of use strict

    const CACHE_KEY_ENTRIES = "entries";
    const CACHE_EVICATION_ENTRIES = 1000 * 60 * 60 * 2; // 2 hours

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

    function Entries() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_ENTRIES, new Cache(CACHE_KEY_ENTRIES, this, CACHE_EVICATION_ENTRIES));

        this._entries = [];
        this._entriesBySourceId = new Map();
        this._entriesByDate = new Map();
        this._entriesByMonth = new Map();
        this._entriesByWeek = new Map();
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

            var entriesBySourceId = this._entriesBySourceId.get(entry.getSourceId());
            if (!entriesBySourceId) {
                entriesBySourceId = [];
            }
            entriesBySourceId.push(entry);

            var entriesByDate = this._entriesByDate.get(entry.getTxnDt());
            if (!entriesByDate) {
                entriesByDate = [];
            }
            entriesByDate.push(entry);

            this._entriesByDate.set(entry.getTxnDt(), entriesByDate);

        },

        /**
         * 
         * @param {string} sourceId 
         * @returns {Entry[]}
         */
        getBySourceId : function(sourceId) {
            return this._entriesBySourceId.get(sourceId);
        },

        /**
         * 
         * @param {Date} txnDt 
         * @returns {Entry[]}
         */
        getByDate : function(txnDt) {
            return this._entriesByDate.get(txnDt);
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
     * @param {string} sourceType 
     * @param {string} sourceId 
     * @param {Date} txnDt 
     * @param {string} narration 
     * @param {string} reference 
     * @param {number} debit
     * @param {number} credit
     */
    function Entry(sourceType, sourceId, txnDt, narration, reference, debit, credit) {
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.txnDt = txnDt;
        this.narration = narration;
        this.reference = reference;
        this.debit = debit;
        this.credit = credit;
        this.labels = [];
    }

    $.extend(Entry.prototype, {
        /**
         * 
         * @returns {string}
         */
        getSourceType : function () {
            return this.sourceType;
        },

        /**
         * 
         * @returns {string}
         */
        getSourceId : function () {
            return this.sourceId;
        },

        /**
         * 
         * @returns {Date}
         */
        getTxnDt : function () {
            return this.txnDt;
        },

        /**
         * 
         * @returns {string}
         */
        getNarration : function () {
            return this.narration;
        },

        /**
         * 
         * @returns {string}
         */
        getReference : function () {
            return this.reference;
        },

        /**
         * 
         * @returns {number}
         */
        getDebit : function () {
            return this.debit;
        },

        /**
         * 
         * @returns {number}
         */
        getCredit : function () {
            return this.credit;
        },


    });

    /**
     * 
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Entry}
     */
    Entry.fromRecord = function (row, metadata) {
        if (!row[metadata.txnDt.index] || row[metadata.txnDt.index] === "") {
            return ;
        }
        var entry = new Entry(
            row[metadata.sourceType.index], 
            row[metadata.sourceId.index], 
            row[metadata.txnDt.index], 
            row[metadata.narration.index], 
            row[metadata.reference.index],
            row[metadata.debit.index],
            row[metadata.credit.index]
        );
        if (row[metadata.labels.index] && row[metadata.labels.index] !== "") {
            entry.setLabels(row[metadata.labels.index].split(","));
        }
        return entry;
    };

    /**
     * 
     * @param {object} data 
     * @returns {Entry}
     */
    Entry.fromJson = function (data) {
        var entry = new Entry(
            data["sourceType"], 
            data["sourceId"], 
            data["txnDt"], 
            data["narration"], 
            data["reference"],
            data["debit"],
            data["credit"]
        );
        if (data["labels"]) {
            entry.setLabels(data["labels"].split(","));
        }
        return entry;
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