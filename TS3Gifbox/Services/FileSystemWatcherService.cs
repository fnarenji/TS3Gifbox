using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;
using TS3Gifbox.Services.Contracts;

namespace TS3Gifbox.Services
{
    class FileSystemWatcherService : IFileSystemWatcherService
    {
        public IFileSystemWatchdog SetupFileSystemWatch(string path)
        {
            IFileSystemWatchdog watchdoge = new FileSystemWatchdog(path);

            return watchdoge;
        }
    }
}
