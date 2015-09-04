using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TS3Gifbox.Logging
{
    public class LogicalOperationScope : IDisposable
    {
        public LogicalOperationScope(string operationId)
        {
            Trace.CorrelationManager.StartLogicalOperation(operationId);
        }

        public void Dispose()
        {
            Trace.CorrelationManager.StopLogicalOperation();
        }
    }
}
