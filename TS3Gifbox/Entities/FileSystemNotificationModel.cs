using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TS3Gifbox.Entities
{
    public class FileSystemNotificationModel
    {
        public string FilePath { get; set; }

        public WatcherChangeTypes ChangeType { get; set; }
    }
}
