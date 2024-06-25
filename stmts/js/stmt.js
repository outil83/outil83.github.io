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
        },

        clear: function(cacheKey) {
            if (this.mapCache.has(cacheKey)) {
                var cache = this.mapCache.get(cacheKey);
                cache.clear();
                this.mapCache.delete(cacheKey);
            }
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
        },

        clear : function() {
            localStorage.removeItem(this._cacheKey);
            localStorage.removeItem(this._cacheKey + "_time");    
        }
    });

    function Entries() {
        this.cachable = new Cachable();
        $.cacheManager.register(CACHE_KEY_ENTRIES, new Cache(CACHE_KEY_ENTRIES, this, CACHE_EVICATION_ENTRIES));

        this._entries = [];
        this._entriesBySourceId = new Map();
        this._entriesByDate = new Map();
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
         */
        add : function(entry) {
            this._entries.push(entry);

            var entriesBySourceId = this._entriesBySourceId.get(entry.getSourceId());
            if (!entriesBySourceId) {
                entriesBySourceId = [];
            }
            entriesBySourceId.push(entry);

            var entriesByDate = this._entriesByDate.get(entry.getTxnDate());
            if (!entriesByDate) {
                entriesByDate = [];
            }
            entriesByDate.push(entry);

            this._entriesByDate.set(entry.getTxnDate(), entriesByDate);

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
         * @param {Date} txnDate 
         * @returns {Entry[]}
         */
        getByDate : function(txnDate) {
            return this._entriesByDate.get(txnDate);
        },

        /**
         * 
         * @returns {Entry[]}
         */
        getAll : function() {
            return this._entries;
        },

        clear : function() {
            $.cacheManager.clear(CACHE_KEY_ENTRIES);
            this._entries = [];
            this._entriesBySourceId = new Map();
            this._entriesByDate = new Map();
        }
    });

    /**
     * 
     * @param {number} entryId 
     * @param {string} sourceType 
     * @param {string} sourceId 
     * @param {Date} txnDate 
     * @param {string} narration 
     * @param {string} reference 
     * @param {number} debit
     * @param {number} credit
     * @param {number} closingBalance 
     * @param {number} amount 
     * @param {Date} valueDate 
     */
    function Entry(entryId, sourceType, sourceId, txnDate, narration, reference, debit, credit, closingBalance, amount, valueDate) {
        this.entryId = entryId;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.txnDate = txnDate;
        this.narration = narration;
        this.reference = reference;
        this.debit = debit;
        this.credit = credit;
        this.closingBalance = closingBalance;
        this.amount = amount;
        this.valueDate = valueDate;
        this.labels = [];
    }

    $.extend(Entry.prototype, {
        /**
         * 
         * @returns {number}
         */
        getEntryId : function () {
            return this.entryId;
        },

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
        getTxnDate : function () {
            return this.txnDate;
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

        /**
         * 
         * @returns {number}
         */
        getClosingBalance : function () {
            return this.closingBalance;
        },

        /**
         * 
         * @returns {number}
         */
        getAmount : function () {
            return this.amount;
        },

        /**
         * 
         * @returns {Date}
         */
        getValueDate : function () {
            return this.valueDate;
        },

        /**
         * 
         * @returns {[]}
         */
        getLabels : function() {
            return this.labels;
        },

        /**
         * 
         * @param {[]} labels 
         */
        setLabels : function(labels) {
            this.labels = labels;
        }


    });

    /**
     * 
     * @param {number} entryId
     * @param {string[]} row 
     * @param {object} metadata 
     * @returns {Entry}
     */
    Entry.fromRecord = function (entryId, row, metadata) {
        if (!row[metadata.txnDate.index] || row[metadata.txnDate.index] === "") {
            return ;
        }
        var entry = new Entry(
            entryId,
            row[metadata.sourceType.index], 
            row[metadata.sourceId.index], 
            row[metadata.txnDate.index], 
            row[metadata.narration.index], 
            row[metadata.reference.index],
            row[metadata.debit.index],
            row[metadata.credit.index],
            row[metadata.closingBalance.index],
            row[metadata.amount.index],
            row[metadata.valueDate.index]
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
            data["entryId"],
            data["sourceType"], 
            data["sourceId"], 
            data["txnDate"],
            data["narration"], 
            data["reference"],
            data["debit"],
            data["credit"],
            data["closingBalance"],
            data["amount"],
            data["valueDate"],
        );
        if (data["labels"]) {
            entry.setLabels(data["labels"].split(","));
        }
        return entry;
    };

    $.Cache = Cache;
    $.Cachable = Cachable;
    $.Entries = Entries;
    $.Entry = Entry;
    
})(jQuery);
